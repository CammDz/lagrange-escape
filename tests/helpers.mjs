import { readFileSync } from "node:fs";
export const base = process.env.TEST_URL || "http://localhost:5180";
export function testPassword() {
  if (process.env.TEST_ADMIN_PASSWORD) return process.env.TEST_ADMIN_PASSWORD;
  try {
    return JSON.parse(
      readFileSync(new URL("../work/test-auth.json", import.meta.url)),
    ).password;
  } catch {
    throw Error(
      "Define TEST_ADMIN_PASSWORD o ejecuta node scripts/test-setup.mjs.",
    );
  }
}
export async function request(path, body, cookie = "") {
  const r = await fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: new URL(base).origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      Cookie: cookie,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: r.status,
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
  };
}
export async function admin() {
  const r = await request("/login", { password: testPassword() });
  if (r.status !== 200) throw Error(JSON.stringify(r));
  return r.cookie;
}
export const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function client(code, cookie) {
  const { WebSocket } = await import("ws");
  const state = {
    ws: undefined,
    snap: undefined,
    events: [],
    sent: 0,
    errors: [],
    latencies: [],
  };
  let pending = new Map();
  state.connect = () =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(
        base.replace(/^http/, "ws") + "/api/rooms/" + code + "/ws",
        { headers: { Origin: new URL(base).origin, Cookie: cookie } },
      );
      state.ws = ws;
      const timer = setTimeout(() => reject(Error("WebSocket timeout")), 15000);
      ws.on("error", reject);
      ws.on("message", (raw) => {
        const m = JSON.parse(raw);
        state.events.push(m);
        if (m.type === "snapshot") state.snap = m.data;
        else if (m.type === "patch") state.snap = { ...state.snap, ...m.data };
        else if (m.type === "error") state.errors.push(m.message);
        if (state.snap) {
          clearTimeout(timer);
          resolve(state);
        }
        for (const [id, p] of pending)
          if (m.type === "error" || state.snap?.nextSeq > p.seq) {
            pending.delete(id);
            state.latencies.push(performance.now() - p.at);
            p.resolve(m);
          }
      });
    });
  state.send = async (type, data, stage = state.snap?.progress?.stage) => {
    const id = crypto.randomUUID(),
      seq = state.snap?.nextSeq || 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(Error("Action timeout"));
      }, 10000);
      pending.set(id, {
        seq,
        at: performance.now(),
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
      state.ws.send(JSON.stringify({ v: 1, id, seq, type, stage, data }));
      state.sent++;
    });
  };
  state.wait = async (predicate) => {
    const deadline = Date.now() + 15000;
    while (!predicate(state.snap)) {
      if (Date.now() > deadline) throw Error("Snapshot timeout");
      await delay(25);
    }
  };
  await state.connect();
  return state;
}
export async function solve(c) {
  while (c.snap.progress.stage < 4) {
    const stage = c.snap.progress.stage,
      p = c.snap.problem;
    if (stage < 2) {
      const target = (stage === 0 ? p.slots : p.targets).find(
        (t) => !c.snap.progress.done.includes(t.id),
      );
      if (target)
        await c.send(
          "answer",
          { target: target.id, piece: correctPiece(c.snap, target.id) },
          stage,
        );
    } else
      await c.send(
        "answer",
        {
          x: String(solutionN(p)),
          y: String(solutionN(p)),
          lambda: stage === 2 ? `${solutionN(p)}/2` : "1/2",
          value: String(solutionN(p) ** 2),
          objective: "product",
          constraint: "circle",
          interpretation: "upper-bound",
          sum: String(2 * solutionN(p)),
          relation: "equal",
          proof: "square-bound",
          regularity: "nonzero-gradient",
          probe: String((7 * solutionN(p) * solutionN(p)) / 25),
          eqx: "y=2lambda*x",
          eqy: "x=2lambda*y",
        },
        stage,
      );
  }
}

export const solutionN = (p) =>
  p.kind === "rectangle" ? p.resource / 4 : Math.sqrt(p.resource / 2);
export function correctPiece(s, target) {
  const p = s.problem;
  const map = {
    variables: "x, y: dimensiones positivas",
    objective: "f(x,y) = xy",
    constraint:
      p.kind === "rectangle"
        ? `2x + 2y = ${p.resource}`
        : `x² + y² = ${p.resource}`,
    constant: String(p.resource),
    fx: "y",
    fy: "x",
    gx: "2",
    gy: "2",
    eqx: "y = 2λ",
    eqy: "x = 2λ",
  };
  const choices = s.progress.stage === 0 ? p.pieces : p.connections;
  return choices.find((c) => c.label === map[target])?.id;
}
