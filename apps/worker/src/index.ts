import { DurableObject } from "cloudflare:workers";
import {
  actionSchema,
  configSchema,
  joinSchema,
  codeSchema,
  type RoomState,
} from "../../../packages/shared";
import {
  create,
  fresh,
  apply,
  control,
  snapshot,
  advance,
  csv,
} from "./engine";
interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  REGISTRY: DurableObjectNamespace<Registry>;
  APP_ORIGIN: string;
  ENVIRONMENT: string;
  ADMIN_PASSWORD_HASH: string;
}
const json = (
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const random = () =>
  crypto.randomUUID().replaceAll("-", "") +
  crypto.randomUUID().replaceAll("-", "");
const hash = async (t: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
function cookie(req: Request, name: string) {
  return (
    req.headers
      .get("Cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
function setCookie(
  env: Env,
  name: string,
  value: string,
  path = "/api",
  age = 28800,
) {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${age}${env.ENVIRONMENT === "production" ? "; Secure" : ""}`;
}
async function body(req: Request) {
  if (Number(req.headers.get("Content-Length")) > 4096)
    throw Error("Mensaje demasiado grande.");
  const reader = req.body?.getReader();
  if (!reader) throw Error("Cuerpo requerido.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw Error("Mensaje demasiado grande.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function passwordValid(password: string, encoded: string) {
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  const actual = Array.from(new Uint8Array(bits), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++)
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
const registry = (env: Env) =>
  env.REGISTRY.get(env.REGISTRY.idFromName("registry"));
async function reg(env: Env, path: string, data?: unknown) {
  return registry(env).fetch("https://internal" + path, {
    method: data === undefined ? "GET" : "POST",
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url),
        path = url.pathname,
        origin = req.headers.get("Origin");
      if (origin && origin !== env.APP_ORIGIN)
        return json({ error: "Origen no permitido." }, 403);
      if (req.method !== "GET" && origin !== env.APP_ORIGIN)
        return json({ error: "Se requiere un origen válido." }, 403);
      if (
        req.headers.get("Upgrade") === "websocket" &&
        origin !== env.APP_ORIGIN
      )
        return json({ error: "Origen WebSocket no permitido." }, 403);
      const adminToken = cookie(req, "le_admin");
      const isAdmin =
        adminToken.length === 64 &&
        (await reg(env, "/session/" + (await hash(adminToken)))).status === 200;
      if (path === "/api/login" && req.method === "POST") {
        const rateKey = "login:v2:" + req.headers.get("CF-Connecting-IP");
        const limit = await reg(env, "/limit", {
          key: rateKey,
          max: 5,
          window: 900000,
        });
        if (limit.status !== 200)
          return json(
            { error: "Demasiados intentos. Espera 15 minutos." },
            429,
          );
        const b = await body(req);
        if (
          typeof b.password !== "string" ||
          b.password.length > 128 ||
          !env.ADMIN_PASSWORD_HASH ||
          !(await passwordValid(b.password, env.ADMIN_PASSWORD_HASH))
        )
          return json({ error: "Credenciales inválidas." }, 401);
        await reg(env, "/reset-limit", { key: rateKey });
        const token = random();
        await reg(env, "/session", {
          id: await hash(token),
          expires: Date.now() + 28800000,
        });
        return json({ ok: true }, 200, {
          "Set-Cookie": setCookie(env, "le_admin", token),
        });
      }
      if (path === "/api/session")
        return json({ admin: isAdmin }, isAdmin ? 200 : 401);
      if (path === "/api/logout" && req.method === "POST") {
        if (adminToken)
          await reg(env, "/revoke", { id: await hash(adminToken) });
        return json({ ok: true }, 200, {
          "Set-Cookie": setCookie(env, "le_admin", "", "/api", 0),
        });
      }
      if (path === "/api/rooms" && req.method === "GET") {
        if (!isAdmin) return json({ error: "Autenticación requerida." }, 401);
        const codes = (await (await reg(env, "/rooms")).json()) as string[];
        const rooms = await Promise.all(
          codes.map(async (code) => {
            const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
            const r = await stub.fetch("https://internal/snapshot", {
              headers: { "X-Role": "admin" },
            });
            return r.ok ? await r.json() : null;
          }),
        );
        return json(rooms.filter(Boolean));
      }
      if (path === "/api/rooms" && req.method === "POST") {
        if (!isAdmin) return json({ error: "Autenticación requerida." }, 401);
        const config = configSchema.parse(await body(req));
        const code = await (await reg(env, "/reserve", {})).text();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        return stub.fetch("https://internal/create", {
          method: "POST",
          body: JSON.stringify({ code, config }),
        });
      }
      const match = /^\/api\/rooms\/([^/]+)(?:\/(.*))?$/.exec(path);
      if (!match) return json({ error: "Ruta no encontrada." }, 404);
      const code = codeSchema.parse(match[1]),
        route = match[2] || "snapshot";
      if (
        ![
          "snapshot",
          "join",
          "ws",
          "session",
          "control",
          "export",
          "team",
          "kick",
          "config",
          "delete",
        ].includes(route)
      )
        return json({ error: "Ruta no encontrada." }, 404);
      if (
        ["control", "export", "team", "kick", "config", "delete"].includes(
          route,
        ) &&
        !isAdmin
      )
        return json({ error: "Autenticación requerida." }, 401);
      if (
        (["join", "control", "team", "kick", "config", "delete"].includes(
          route,
        ) &&
          req.method !== "POST") ||
        (["snapshot", "session", "ws", "export"].includes(route) &&
          req.method !== "GET")
      )
        return json({ error: "Método no permitido." }, 405);
      if (route === "join") {
        const limited = await reg(env, "/limit", {
          key: "join:" + req.headers.get("CF-Connecting-IP"),
          max: 60,
          window: 60000,
        });
        if (!limited.ok)
          return json({ error: "Demasiados ingresos. Espera un minuto." }, 429);
      }
      const headers = new Headers(req.headers);
      headers.delete("X-Role");
      headers.delete("X-Player");
      headers.set("X-Role", isAdmin ? "admin" : "public");
      headers.set(
        "X-View",
        url.searchParams.get("view") === "public"
          ? "public"
          : url.searchParams.get("view") === "admin" && isAdmin
            ? "admin"
            : "player",
      );
      if (isAdmin) headers.set("X-Admin-Expires", String(Date.now() + 300000)); // admin WS revalidates by reconnect every 5 minutes
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(
        new Request("https://internal/" + route, {
          method: req.method,
          headers,
          body: req.method === "POST" ? req.body : undefined,
          duplex: "half",
        } as RequestInit),
      );
    } catch (error) {
      return json(
        {
          error: error instanceof Error ? error.message : "Solicitud inválida.",
        },
        400,
      );
    }
  },
} satisfies ExportedHandler<Env>;

export class Registry extends DurableObject<Env> {
  async fetch(req: Request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      const path = new URL(req.url).pathname,
        now = Date.now();
      if (path === "/reserve") {
        const codes =
          (await this.ctx.storage.get<Record<string, number>>("rooms")) || {};
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code: string;
        do {
          code = Array.from(
            crypto.getRandomValues(new Uint8Array(6)),
            (x) => alphabet[x % alphabet.length],
          ).join("");
        } while (codes[code]);
        codes[code] = now;
        await this.ctx.storage.put("rooms", codes);
        await this.ctx.storage.setAlarm(now + 86400000);
        return new Response(code);
      }
      if (path === "/rooms") {
        const codes =
          (await this.ctx.storage.get<Record<string, number>>("rooms")) || {};
        return json(
          Object.keys(codes).filter((c) => now - codes[c] < 30 * 86400000),
        );
      }
      if (path === "/session") {
        const b = (await req.json()) as { id: string; expires: number };
        await this.ctx.storage.put("s:" + b.id, b.expires);
        return json({ ok: true });
      }
      if (path.startsWith("/session/")) {
        const exp = await this.ctx.storage.get<number>("s:" + path.slice(9));
        return json({ ok: !!exp && exp > now }, exp && exp > now ? 200 : 401);
      }
      if (path === "/revoke") {
        const b = (await req.json()) as { id: string };
        await this.ctx.storage.delete("s:" + b.id);
        return json({ ok: true });
      }
      if (path === "/reset-limit") {
        const b = (await req.json()) as { key: string };
        await this.ctx.storage.delete("r:" + (await hash(b.key)));
        return json({ ok: true });
      }
      if (path === "/limit") {
        const b = (await req.json()) as {
          key: string;
          max: number;
          window: number;
        };
        const key = "r:" + (await hash(b.key));
        let bucket = await this.ctx.storage.get<{
          count: number;
          expires: number;
        }>(key);
        if (!bucket || bucket.expires < now)
          bucket = { count: 0, expires: now + b.window };
        bucket.count++;
        await this.ctx.storage.put(key, bucket);
        await this.ctx.storage.setAlarm(now + 86400000);
        return json(
          { ok: bucket.count <= b.max },
          bucket.count <= b.max ? 200 : 429,
        );
      }
      return json({}, 404);
    });
  }
  async alarm() {
    const now = Date.now();
    const all = await this.ctx.storage.list();
    for (const [k, v] of all)
      if (
        (k.startsWith("s:") && Number(v) < now) ||
        (k.startsWith("r:") && (v as { expires: number }).expires < now)
      )
        await this.ctx.storage.delete(k);
    const codes =
      (await this.ctx.storage.get<Record<string, number>>("rooms")) || {};
    for (const c of Object.keys(codes))
      if (now - codes[c] > 30 * 86400000) delete codes[c];
    await this.ctx.storage.put("rooms", codes);
    await this.ctx.storage.setAlarm(now + 86400000);
  }
}
interface Attachment {
  id?: string;
  admin: boolean;
  expires: number;
  count: number;
  window: number;
  connection?: string;
}
export class GameRoom extends DurableObject<Env> {
  state?: RoomState;
  chain: Promise<unknown> = Promise.resolve();
  last = new Map<WebSocket, string>();
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = await ctx.storage.get<RoomState>("state");
      if (this.state && !this.state.tiles)
        this.state.tiles = create(
          this.state.code,
          this.state.config,
          this.state.createdAt,
          this.state.variants,
        ).tiles;
    });
  }
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const task = this.chain.then(fn);
    this.chain = task.catch(() => {});
    return task;
  }
  connected() {
    return new Set(
      this.ctx
        .getWebSockets()
        .map((ws) => {
          const a = ws.deserializeAttachment() as Attachment;
          return a.id && a.connection === this.state?.players[a.id]?.connection
            ? a.id
            : undefined;
        })
        .filter((id): id is string => !!id),
    );
  }
  async persist() {
    if (!this.state) return;
    await this.ctx.storage.put("state", this.state);
    const s = this.state;
    const next =
      s.status === "countdown"
        ? s.startedAt
        : s.status === "running"
          ? s.deadline
          : s.createdAt + 30 * 86400000;
    await this.ctx.storage.setAlarm(
      Math.min(next, s.createdAt + 30 * 86400000),
    );
  }
  async player(req: Request) {
    if (!this.state) return undefined;
    const token = cookie(req, "le_" + this.state.code);
    if (token.length !== 64) return undefined;
    const tokenHash = await hash(token);
    return Object.values(this.state.players).find(
      (p) => p.tokenHash === tokenHash && !p.kicked && p.expires > Date.now(),
    );
  }
  view(a: Attachment) {
    return snapshot(this.state!, Date.now(), this.connected(), a.id, a.admin);
  }
  send(ws: WebSocket, force = false) {
    try {
      const a = ws.deserializeAttachment() as Attachment;
      if (a.expires < Date.now()) {
        ws.close(a.admin ? 1012 : 4001, "Sesión expirada");
        return;
      }
      const snap = this.view(a);
      const serialized = JSON.stringify(snap),
        old = this.last.get(ws);
      if (!force && old) {
        const previous = JSON.parse(old) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(snap))
          if (JSON.stringify(v) !== JSON.stringify(previous[k])) patch[k] = v;
        ws.send(
          JSON.stringify({ type: "patch", v: 1, seq: snap.seq, data: patch }),
        );
      } else ws.send(JSON.stringify({ type: "snapshot", data: snap }));
      this.last.set(ws, serialized);
    } catch {
      this.last.delete(ws);
    }
  }
  broadcast() {
    for (const ws of this.ctx.getWebSockets()) this.send(ws);
  }
  async fetch(req: Request): Promise<Response> {
    return this.exclusive(async () => {
      try {
        const path = new URL(req.url).pathname;
        const admin = req.headers.get("X-Role") === "admin";
        if (path === "/create") {
          if (this.state) return json({ error: "Ya existe." }, 409);
          const b = (await req.json()) as { code: string; config: unknown };
          const bytes = crypto.getRandomValues(new Uint8Array(2));
          this.state = create(
            b.code,
            configSchema.parse(b.config),
            Date.now(),
            [bytes[0] % 8, bytes[1] % 8],
          );
          await this.persist();
          return json({ code: b.code }, 201);
        }
        if (!this.state)
          return json({ error: "La sala no existe o expiró." }, 404);
        const s = this.state;
        if (s.status === "waiting" && s.config.duration !== 10) {
          s.config = { ...s.config, duration: 10 };
          s.remaining = 600000;
        }
        advance(s, Date.now());
        const player = await this.player(req);
        if (path === "/join") {
          if (player) return json({ id: player.id });
          if (s.status !== "waiting" || !s.open)
            return json({ error: "El ingreso está cerrado." }, 409);
          const b = joinSchema.parse(await body(req));
          const active = Object.values(s.players).filter((p) => !p.kicked);
          if (active.length >= s.config.maxPlayers)
            return json({ error: "La sala está llena." }, 409);
          if (
            active.some(
              (p) =>
                p.nickname.toLocaleLowerCase("es") ===
                b.nickname.toLocaleLowerCase("es"),
            )
          )
            return json({ error: "Este apodo ya está en uso." }, 409);
          if (s.config.mode === "individual" && (b.team || b.newTeam))
            return json({ error: "Esta sala es individual." }, 400);
          let teamId = b.team;
          if (b.newTeam) {
            if (!s.config.allowTeams)
              return json(
                { error: "Solo el administrador puede crear equipos." },
                403,
              );
            if (
              Object.values(s.teams).some(
                (t) => t.name.toLowerCase() === b.newTeam!.toLowerCase(),
              )
            )
              return json({ error: "El equipo ya existe; selecciónalo." }, 409);
            teamId = crypto.randomUUID();
          }
          if (
            teamId &&
            !b.newTeam &&
            (!s.teams[teamId] ||
              s.teams[teamId].members.length >= s.config.teamSize)
          )
            return json({ error: "Equipo inexistente o lleno." }, 409);
          const id = crypto.randomUUID(),
            token = random();
          if (b.newTeam && teamId) {
            s.teams[teamId] = { id: teamId, name: b.newTeam, members: [] };
            s.progress[teamId] = fresh();
          }
          s.players[id] = {
            id,
            nickname: b.nickname,
            avatar:
              b.avatar ??
              Array.from(b.nickname).reduce(
                (total, c) => total + c.codePointAt(0)!,
                0,
              ) % 6,
            teamId,
            tokenHash: await hash(token),
            expires: Date.now() + 86400000,
            ready: false,
            kicked: false,
            lastSeen: Date.now(),
            seq: 0,
            seen: [],
          };
          if (teamId) s.teams[teamId].members.push(id);
          else s.progress[id] = fresh();
          s.seq++;
          await this.persist();
          this.broadcast();
          return json({ id }, 201, {
            "Set-Cookie": setCookie(
              this.env,
              "le_" + s.code,
              token,
              "/api/rooms/" + s.code,
              86400,
            ),
          });
        }
        if (path === "/session")
          return player
            ? json({ id: player.id })
            : json({ error: "No hay sesión de participante." }, 401);
        if (path === "/snapshot") {
          await this.persist();
          return json(
            snapshot(s, Date.now(), this.connected(), player?.id, admin),
          );
        }
        if (path === "/ws") {
          if (req.headers.get("Upgrade") !== "websocket")
            return json({ error: "Se requiere WebSocket." }, 426);
          if (this.ctx.getWebSockets().length >= 75)
            return json({ error: "Demasiadas conexiones." }, 429);
          const view = req.headers.get("X-View"),
            identity =
              view === "public" || view === "admin" ? undefined : player;
          const pair = new WebSocketPair(),
            client = pair[0],
            server = pair[1];
          if (identity)
            for (const ws of this.ctx.getWebSockets())
              if ((ws.deserializeAttachment() as Attachment).id === identity.id)
                ws.close(4002, "Otra pestaña tomó el control");
          const connection = identity ? crypto.randomUUID() : undefined;
          if (identity) identity.connection = connection;
          this.ctx.acceptWebSocket(server);
          server.serializeAttachment({
            id: identity?.id,
            connection,
            admin: admin && view !== "public",
            expires:
              identity?.expires ||
              (admin && view !== "public"
                ? Number(req.headers.get("X-Admin-Expires"))
                : Date.now() + 3600000),
            count: 0,
            window: Date.now(),
          } satisfies Attachment);
          s.seq++;
          await this.persist();
          this.send(server, true);
          this.broadcast();
          return new Response(null, { status: 101, webSocket: client });
        }
        if (!admin) return json({ error: "Autorización requerida." }, 403);
        if (path === "/export")
          return new Response(csv(s), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="lagrange-${s.code}.csv"`,
              "Cache-Control": "no-store",
            },
          });
        if (path === "/delete") {
          for (const ws of this.ctx.getWebSockets())
            ws.close(4001, "Sala eliminada");
          await this.ctx.storage.deleteAll();
          this.state = undefined;
          return json({ ok: true });
        }
        const b = await body(req);
        if (path === "/control") {
          control(s, String(b.command), Date.now());
        } else if (path === "/kick") {
          if (s.status !== "waiting")
            return json(
              {
                error:
                  "Solo se puede expulsar participantes antes de iniciar la partida.",
              },
              409,
            );
          const p = s.players[b.id];
          if (!p) throw Error("Participante inexistente.");
          p.kicked = true;
          if (p.teamId)
            s.teams[p.teamId].members = s.teams[p.teamId].members.filter(
              (x) => x !== p.id,
            );
          for (const ws of this.ctx.getWebSockets())
            if ((ws.deserializeAttachment() as Attachment).id === p.id)
              ws.close(4001, "Expulsado por administración");
        } else if (path === "/config") {
          if (s.status !== "waiting") throw Error("Solo antes de iniciar.");
          const c = configSchema.parse(b);
          if (c.mode !== s.config.mode && Object.keys(s.players).length)
            throw Error("No cambies la modalidad con participantes.");
          if (
            Object.values(s.players).filter((p) => !p.kicked).length >
              c.maxPlayers ||
            Object.values(s.teams).some((t) => t.members.length > c.teamSize)
          )
            throw Error(
              "Los nuevos límites son inferiores a la ocupación actual.",
            );
          s.config = c;
          s.remaining = c.duration * 60000;
        } else if (path === "/team") {
          if (s.status !== "waiting")
            throw Error("Los equipos se fijan al iniciar.");
          if (s.config.mode === "individual") throw Error("Sala individual.");
          if (b.name) {
            const name = joinSchema.shape.newTeam.parse(b.name)!;
            if (
              Object.values(s.teams).some(
                (t) => t.name.toLowerCase() === name.toLowerCase(),
              )
            )
              throw Error("Nombre duplicado.");
            const id = crypto.randomUUID();
            s.teams[id] = { id, name, members: [] };
            s.progress[id] = fresh();
          } else {
            const p = s.players[b.playerId],
              team = s.teams[b.teamId];
            if (
              !p ||
              p.kicked ||
              !team ||
              team.members.length >= s.config.teamSize
            )
              throw Error("Jugador o equipo no válido.");
            if (p.teamId)
              s.teams[p.teamId].members = s.teams[p.teamId].members.filter(
                (id) => id !== p.id,
              );
            else delete s.progress[p.id];
            p.teamId = team.id;
            team.members.push(p.id);
          }
        } else return json({ error: "Ruta no encontrada." }, 404);
        s.seq++;
        s.events.push({
          type: path,
          actor: "admin",
          at: Date.now(),
          detail: String(b.command || ""),
        });
        s.events = s.events.slice(-3000);
        await this.persist();
        this.broadcast();
        return json({ ok: true });
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error ? error.message : "Error de solicitud.",
          },
          400,
        );
      }
    });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    return this.exclusive(async () => {
      const a = ws.deserializeAttachment() as Attachment;
      try {
        if (!this.state || a.expires < Date.now())
          return ws.close(a.admin ? 1012 : 4001, "Sesión expirada");
        if (typeof message !== "string" || message.length > 4096)
          return ws.close(1009, "Mensaje demasiado grande");
        const now = Date.now();
        if (now - a.window >= 10000) {
          a.window = now;
          a.count = 0;
        }
        a.count++;
        ws.serializeAttachment(a);
        if (a.count > 40) return ws.close(4008, "Demasiadas acciones");
        const action = actionSchema.parse(JSON.parse(message));
        if (action.type === "snapshot") {
          this.send(ws, true);
          return;
        }
        if (
          !a.id ||
          !this.state.players[a.id] ||
          this.state.players[a.id].kicked ||
          a.connection !== this.state.players[a.id].connection
        )
          return ws.close(4003, "Sin permiso");
        apply(this.state, a.id, action, now);
        this.state.seq++;
        this.state.events.push({
          type: action.type,
          actor: a.id,
          at: now,
          detail:
            this.state.progress[this.state.players[a.id].teamId || a.id]
              ?.feedback || "",
        });
        this.state.events = this.state.events.slice(-3000);
        await this.persist();
        this.broadcast();
      } catch (error) {
        await this.persist();
        const player = a.id ? this.state?.players[a.id] : undefined;
        ws.send(
          JSON.stringify({
            type: "error",
            message:
              error instanceof Error ? error.message : "Mensaje inválido",
            nextSeq: player ? player.seq + 1 : undefined,
          }),
        );
        this.send(ws, true);
      }
    });
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.last.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    return this.exclusive(async () => {
      if (this.state) {
        this.state.seq++;
        await this.persist();
        this.broadcast();
      }
    });
  }
  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011, "Conexión interrumpida");
  }
  async alarm() {
    return this.exclusive(async () => {
      if (!this.state) return;
      if (Date.now() >= this.state.createdAt + 30 * 86400000) {
        for (const ws of this.ctx.getWebSockets())
          ws.close(4001, "Retención finalizada");
        await this.ctx.storage.deleteAll();
        this.state = undefined;
        return;
      }
      advance(this.state, Date.now());
      this.state.seq++;
      await this.persist();
      this.broadcast();
    });
  }
}
