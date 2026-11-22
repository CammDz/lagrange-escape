import type {
  RoomState,
  Progress,
  Config,
  Action,
  Entry,
  Snapshot,
  Problem,
} from "../../../packages/shared";
import { publicProblem, validate, hint } from "../../../packages/math";
export const fresh = (): Progress => ({
  links: {},
  stage: 0,
  done: [],
  score: 0,
  correct: 0,
  errors: 0,
  hints: 0,
  stageErrors: 0,
  stageHints: 0,
  lastTime: 0,
  seq: 0,
  seen: [],
  feedback: "Explora el reactor y conecta las piezas.",
  hintText: "",
  chambers: [],
});
export function create(
  code: string,
  config: Config,
  now: number,
  variants: [number, number],
): RoomState {
  return {
    code,
    config,
    status: "waiting",
    createdAt: now,
    startedAt: 0,
    finishedAt: 0,
    remaining: config.duration * 60000,
    deadline: 0,
    seq: 0,
    open: true,
    variants,
    tiles: Object.fromEntries(
      [
        "variables",
        "objective",
        "constraint",
        "constant",
        "decoy",
        "fx",
        "fy",
        "gx",
        "gy",
        "eqx",
        "eqy",
      ].map((id) => [id, crypto.randomUUID()]),
    ),
    players: {},
    teams: {},
    progress: {},
    events: [],
  };
}
export function remaining(s: RoomState, now: number) {
  return s.status === "running"
    ? Math.max(0, s.deadline - now)
    : s.status === "countdown"
      ? s.config.duration * 60000
      : s.remaining;
}
export function advance(s: RoomState, now: number) {
  if (s.status === "countdown" && now >= s.startedAt) {
    s.status = "running";
    s.deadline = s.startedAt + s.config.duration * 60000;
  }
  if (s.status === "running" && now >= s.deadline) {
    s.status = "finished";
    s.remaining = 0;
    s.finishedAt = s.deadline;
  }
}
export function control(s: RoomState, cmd: string, now: number) {
  advance(s, now);
  if (cmd === "start" && s.status === "waiting") {
    s.config = { ...s.config, duration: 10 };
    s.remaining = 600000;
    if (!Object.values(s.players).some((p) => !p.kicked))
      throw Error("La sala está vacía.");
    if (
      s.config.mode === "teams" &&
      Object.values(s.players).some(
        (p) =>
          !p.kicked &&
          (!p.teamId || !s.teams[p.teamId]?.members.includes(p.id)),
      )
    )
      throw Error("Asigna un equipo a cada participante antes de iniciar.");
    s.open = false;
    s.status = "countdown";
    s.startedAt = now + 3000;
    s.deadline = s.startedAt + s.remaining;
  } else if (cmd === "pause" && s.status === "running") {
    s.remaining = remaining(s, now);
    s.status = "paused";
  } else if (cmd === "resume" && s.status === "paused") {
    s.status = "running";
    s.deadline = now + s.remaining;
  } else if (
    cmd === "finish" &&
    ["running", "paused", "countdown"].includes(s.status)
  ) {
    s.remaining = remaining(s, now);
    s.status = "finished";
    s.finishedAt = now;
  } else if (cmd === "toggle" && s.status === "waiting") {
    s.open = !s.open;
  } else throw Error("Transición no permitida.");
}
export const entity = (s: RoomState, id: string) => s.players[id]?.teamId || id;
export function apply(s: RoomState, id: string, a: Action, now: number) {
  advance(s, now);
  const player = s.players[id];
  if (!player || player.kicked) throw Error("Sesión inválida.");
  if (a.type === "snapshot") return;
  if (player.seen.includes(a.id)) return;
  if (a.seq !== player.seq + 1)
    throw Error("Secuencia obsoleta. Reconecta para sincronizar.");
  player.seq = a.seq;
  player.seen.push(a.id);
  player.seen = player.seen.slice(-256);
  player.lastSeen = now;
  const p = s.progress[entity(s, id)];
  p.links ??= Object.fromEntries(
    p.done.map((target) => [target, s.tiles[target]]),
  );
  if (a.type === "signal") {
    if (!player.teamId || s.status === "finished")
      throw Error("Las señales son para tu equipo durante la misión.");
    const text = (
      {
        idea: "Tengo una idea",
        help: "Necesito ayuda",
        cheer: "¡Vamos, equipo!",
      } as Record<string, string>
    )[a.data?.signal || ""];
    if (!text) throw Error("Señal no válida.");
    if (p.signal && now - p.signal.at < 2000)
      throw Error("Espera un momento antes de enviar otra señal.");
    p.signal = { from: player.nickname, text, at: now };
    return;
  }
  if (a.type === "ready") {
    if (s.status !== "waiting") throw Error("La partida ya comenzó.");
    player.ready = !player.ready;
    return;
  }
  if (s.status !== "running")
    throw Error("Las acciones están bloqueadas en este estado.");
  if (p.stage >= 4) throw Error("Ya completaste la misión.");
  if (a.stage !== p.stage)
    throw Error("La cámara cambió. Usa el estado sincronizado.");
  const problem = publicProblem(p.stage, s.variants);
  if (a.type === "hint") {
    if (!s.config.hints) throw Error("Las pistas están desactivadas.");
    if (p.stageHints === 0) {
      p.hints++;
      p.stageHints = 1;
    }
    p.hintText = hint(p.stage, problem);
    return;
  }
  const data = { ...a.data };
  if (p.stage < 2) {
    if (p.done.includes(data.target || "")) {
      p.feedback = "Este par ya está conectado y bloqueado.";
      return;
    }
    if (data.piece && Object.values(p.links).includes(data.piece))
      throw Error(
        "Esta pieza ya pertenece a un par correcto y está bloqueada.",
      );
  }
  if (data.piece)
    data.piece =
      Object.keys(s.tiles).find((k) => s.tiles[k] === data.piece) || "invalid";
  const r = validate(p.stage, data, problem, p.done);
  p.feedback = r.message;
  if (!r.correct) {
    p.errors++;
    p.stageErrors++;
    return;
  }
  if (p.done.includes(r.key)) return;
  if (p.stage < 2 && a.data?.piece) p.links[r.key] = a.data.piece;
  p.done.push(r.key);
  p.correct++;
  p.lastTime = s.config.duration * 60000 - remaining(s, now);
  const required = [4, 7, 1, 1][p.stage];
  if (p.done.length >= required) {
    const base = [150, 250, 250, 350][p.stage];
    const earned = Math.max(Math.round(base * 0.5), base - 10 * p.stageErrors);
    const bonus = p.stageHints === 0 ? Math.max(0, 25 - 5 * p.stageErrors) : 0;
    p.score += earned + bonus;
    p.chambers.push({
      score: earned + bonus,
      errors: p.stageErrors,
      hints: p.stageHints,
      time: p.lastTime,
    });
    p.stage++;
    p.done = [];
    p.links = {};
    p.stageErrors = 0;
    p.stageHints = 0;
    p.hintText = "";
  }
}
export function leaderboard(s: RoomState, connected: Set<string>): Entry[] {
  const rows: Entry[] = [];
  for (const [id, p] of Object.entries(s.progress)) {
    const team = s.teams[id],
      player = s.players[id];
    if (!team && (!player || player.kicked)) continue;
    if (team && !team.members.some((m) => !s.players[m]?.kicked)) continue;
    rows.push({
      id,
      name: team?.name || player.nickname,
      category: team ? "team" : "individual",
      score: p.score,
      stage: p.stage,
      steps: p.correct,
      hints: p.hints,
      errors: p.errors,
      lastTime: p.lastTime,
      connected: team
        ? team.members.some((m) => connected.has(m))
        : connected.has(id),
      rank: 0,
    });
  }
  const compare = (a: Entry, b: Entry) =>
    b.score - a.score ||
    b.stage - a.stage ||
    b.steps - a.steps ||
    a.hints - b.hints ||
    a.lastTime - b.lastTime;
  rows.sort(compare);
  for (const category of ["individual", "team"]) {
    const group = rows.filter((r) => r.category === category);
    group.forEach((r, i) => {
      r.rank = i && compare(r, group[i - 1]) === 0 ? group[i - 1].rank : i + 1;
    });
  }
  return rows;
}
export function visibleProblem(s: RoomState, stage: number): Problem {
  const { n: _n, ...p } = publicProblem(stage, s.variants);
  return {
    ...p,
    objective: stage === 0 ? "" : p.objective,
    constraint: stage === 0 ? "" : p.constraint,
    pieces: p.pieces.map((c) => ({ ...c, id: s.tiles[c.id] })),
    connections: p.connections.map((c) => ({ ...c, id: s.tiles[c.id] })),
  };
}
export function snapshot(
  s: RoomState,
  now: number,
  connected: Set<string>,
  id?: string,
  admin = false,
): Snapshot {
  advance(s, now);
  const p = id ? s.progress[entity(s, id)] : undefined;
  if (p && p.stage < 2)
    p.links ??= Object.fromEntries(
      p.done.map((target) => [target, s.tiles[target]]),
    );
  return {
    v: 1,
    seq: s.seq,
    serverNow: now,
    code: s.code,
    config: s.config,
    status: s.status,
    open: s.open,
    remaining: remaining(s, now),
    deadline: s.status === "countdown" ? s.startedAt : s.deadline,
    players: Object.values(s.players)
      .filter((p) => !p.kicked)
      .map((p) => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar ?? 0,
        teamId: p.teamId,
        ready: p.ready,
        connected: connected.has(p.id),
        lastSeen: p.lastSeen,
      })),
    teams: Object.values(s.teams),
    leaderboard:
      admin || s.config.ranking || s.status === "finished"
        ? leaderboard(s, connected)
        : [],
    ...(id
      ? {
          you: id,
          progress: p,
          problem: p && p.stage < 4 ? visibleProblem(s, p.stage) : undefined,
          nextSeq: s.players[id].seq + 1,
        }
      : {}),
  };
}
export function csv(s: RoomState) {
  const esc = (x: unknown) => {
    let t = String(x ?? "");
    if (/^[=+@\-\t\r]/.test(t)) t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Categoría",
      "Posición",
      "Nombre",
      "Puntos",
      "Cámaras",
      "Aciertos",
      "Errores",
      "Pistas",
      "Tiempo efectivo (s)",
      ...Array.from(
        { length: 4 },
        (_, i) => `Cámara ${i + 1}: puntos/errores/pistas/segundos`,
      ),
    ],
    ...leaderboard(s, new Set()).map((r) => [
      r.category,
      r.rank,
      r.name,
      r.score,
      r.stage,
      r.steps,
      r.errors,
      r.hints,
      r.lastTime / 1000,
      ...s.progress[r.id].chambers.map(
        (c) => `${c.score}/${c.errors}/${c.hints}/${c.time / 1000}`,
      ),
    ]),
  ];
  return "\ufeff" + rows.map((row) => row.map(esc).join(";")).join("\r\n");
}
