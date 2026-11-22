import { describe, it, expect } from "vitest";
import {
  configSchema,
  joinSchema,
  actionSchema,
  type Action,
  type RoomState,
} from "../packages/shared";
import {
  create,
  fresh,
  apply,
  control,
  advance,
  remaining,
  leaderboard,
  csv,
  snapshot,
} from "../apps/worker/src/engine";
import { official, publicProblem } from "../packages/math";
const config = configSchema.parse({ duration: 8 });
function setup(team = false) {
  const s = create("ABC234", { ...config }, 1000, [2, 3]);
  for (const id of ["a", "b"]) {
    s.players[id] = {
      id,
      nickname: id === "a" ? "Ana" : "Luis",
      tokenHash: "secret",
      expires: 999999999,
      ready: false,
      kicked: false,
      lastSeen: 1000,
      seq: 0,
      seen: [],
      teamId: team ? "t" : undefined,
    };
    if (!team) s.progress[id] = fresh();
  }
  if (team) {
    s.teams.t = { id: "t", name: "Equipo", members: ["a", "b"] };
    s.progress.t = fresh();
  }
  return s;
}
function action(
  s: RoomState,
  id: string,
  stage: number,
  data: Record<string, string>,
  uuid = crypto.randomUUID(),
): Action {
  if (data.piece) data = { ...data, piece: s.tiles[data.piece] };
  return {
    v: 1,
    id: uuid,
    seq: s.players[id].seq + 1,
    type: "answer",
    stage,
    data,
  };
}
function solve(s: RoomState, id = "a", now = 5000) {
  for (let stage = 0; stage < 4; stage++) {
    const p = publicProblem(stage, s.variants);
    if (stage < 2)
      for (const t of stage === 0 ? p.slots : p.targets)
        apply(s, id, action(s, id, stage, { target: t.id, piece: t.id }), now);
    else {
      const o = official(p);
      apply(
        s,
        id,
        action(s, id, stage, {
          x: String(o.x),
          y: String(o.y),
          lambda: String(o.lambda),
          value: String(o.value),
          objective: "product",
          constraint: "circle",
          interpretation: "upper-bound",
          sum: String(2 * p.n),
          relation: "equal",
          proof: "square-bound",
          regularity: "nonzero-gradient",
          probe: String((7 * p.n * p.n) / 25),
          eqx: "y=2lambda*x",
          eqy: "x=2lambda*y",
        }),
        now,
      );
    }
  }
}
describe("Reloj autoritativo", () => {
  it("duración nueva de 15 minutos y configuración hasta 20", () => {
    expect(configSchema.parse({}).duration).toBe(15);
    expect(configSchema.parse({ duration: 20 }).duration).toBe(20);
    expect(configSchema.safeParse({ duration: 21 }).success).toBe(false);
    const s = setup();
    s.config.duration = 15;
    s.remaining = 900000;
    control(s, "start", 1000);
    advance(s, 4000);
    expect(remaining(s, 4000)).toBe(900000);
  });
  it("8 minutos efectivos, countdown excluido y cierre exacto", () => {
    const s = setup();
    control(s, "start", 1000);
    expect(s.startedAt).toBe(4000);
    advance(s, 4000);
    expect(remaining(s, 4000)).toBe(480000);
    advance(s, 484000);
    expect(s.status).toBe("finished");
    expect(s.finishedAt).toBe(484000);
  });
  it("pausa conserva tiempo y reanuda con nueva fecha límite", () => {
    const s = setup();
    control(s, "start", 1000);
    control(s, "pause", 14000);
    expect(s.remaining).toBe(470000);
    expect(remaining(s, 999999)).toBe(470000);
    control(s, "resume", 1000000);
    expect(s.deadline).toBe(1470000);
  });
  it("no permite iniciar vacía ni transiciones inválidas", () => {
    expect(() =>
      control(create("ABC234", config, 0, [0, 0]), "start", 0),
    ).toThrow();
    expect(() => control(setup(), "resume", 0)).toThrow();
  });
});
describe("Concurrencia, puntos y seguridad", () => {
  it("acepta apariencias existentes y rechaza identificadores de personaje manipulados", () => {
    expect(joinSchema.parse({ nickname: "Ada", avatar: 5 }).avatar).toBe(5);
    expect(joinSchema.safeParse({ nickname: "Ada", avatar: 6 }).success).toBe(
      false,
    );
    expect(
      joinSchema.safeParse({ nickname: "Ada", avatar: "admin" }).success,
    ).toBe(false);
  });
  it("señales de equipo sincronizadas sin puntos ni ayudas; rechaza texto arbitrario", () => {
    const s = setup(true);
    apply(
      s,
      "a",
      { ...action(s, "a", 0, { signal: "idea" }), type: "signal" },
      2000,
    );
    expect(s.progress.t.signal?.text).toBe("Tengo una idea");
    expect(s.progress.t.score).toBe(0);
    expect(s.progress.t.hints).toBe(0);
    expect(snapshot(s, 2000, new Set(), "b").progress?.signal?.from).toBe(
      "Ana",
    );
    expect(() =>
      apply(
        s,
        "b",
        { ...action(s, "b", 0, { signal: "<script>" }), type: "signal" },
        5000,
      ),
    ).toThrow("Señal");
    expect(() =>
      apply(
        setup(),
        "a",
        { ...action(setup(), "a", 0, { signal: "idea" }), type: "signal" },
        5000,
      ),
    ).toThrow("equipo");
  });
  it("completa las cuatro cámaras sin finalizar a los demás; máximo 1100", () => {
    const s = setup();
    control(s, "start", 1000);
    solve(s);
    expect(s.progress.a.stage).toBe(4);
    expect(s.progress.a.score).toBe(1100);
    expect(s.progress.b.stage).toBe(0);
    expect(s.status).toBe("running");
  });
  it("equipo comparte avance sin multiplicar puntos", () => {
    const s = setup(true);
    control(s, "start", 1000);
    const a = action(s, "a", 0, { target: "objective", piece: "objective" });
    apply(s, "a", a, 5000);
    apply(s, "a", a, 5001);
    apply(
      s,
      "b",
      action(s, "b", 0, { target: "objective", piece: "objective" }),
      5002,
    );
    expect(s.progress.t.correct).toBe(1);
    solve(s);
    expect(s.progress.t.score).toBe(1100);
    expect(leaderboard(s, new Set()).length).toBe(1);
  });
  it("replay, secuencias obsoletas y salto de cámara", () => {
    const s = setup();
    control(s, "start", 1000);
    const a = action(s, "a", 0, { target: "variables", piece: "variables" });
    apply(s, "a", a, 5000);
    apply(s, "a", a, 5001);
    expect(s.progress.a.correct).toBe(1);
    expect(() =>
      apply(s, "a", { ...a, id: crypto.randomUUID() }, 5002),
    ).toThrow("Secuencia");
    expect(() => apply(s, "a", action(s, "a", 3, {}), 5002)).toThrow("cámara");
  });
  it("bloquea fuera de tiempo, en pausa y expulsados", () => {
    const s = setup();
    control(s, "start", 1000);
    control(s, "pause", 5000);
    expect(() => apply(s, "a", action(s, "a", 0, {}), 6000)).toThrow();
    control(s, "resume", 10000);
    expect(() => apply(s, "a", action(s, "a", 0, {}), 9999999)).toThrow();
    s.players.a.kicked = true;
    expect(() => apply(s, "a", action(s, "a", 0, {}), 10000000)).toThrow();
  });
  it("errores y pista única reducen puntaje de forma acotada", () => {
    const s = setup();
    control(s, "start", 1000);
    for (let i = 0; i < 30; i++)
      apply(
        s,
        "a",
        action(s, "a", 0, { target: "objective", piece: "decoy" }),
        5000,
      );
    for (let i = 0; i < 2; i++)
      apply(s, "a", { ...action(s, "a", 0, {}), type: "hint" }, 5000);
    solve(s);
    expect(s.progress.a.hints).toBe(1);
    expect(s.progress.a.score).toBe(1000);
    expect(s.progress.a.score).toBeGreaterThanOrEqual(0);
  });
  it("no revela respuestas, tokens ni progreso ajeno en proyección", () => {
    const s = setup();
    const view = snapshot(s, 1000, new Set());
    const text = JSON.stringify(view);
    expect(text).not.toContain("secret");
    expect(view.problem).toBeUndefined();
    expect(view.progress).toBeUndefined();
    expect(view.nextSeq).toBeUndefined();
    const own = snapshot(s, 1000, new Set(), "a");
    expect(own.problem).not.toHaveProperty("n");
    expect(own.problem?.objective).toBe("");
    expect(own.problem?.constraint).toBe("");
    expect(
      own.problem?.pieces.every(
        (piece) => !own.problem!.slots.some((t) => t.id === piece.id),
      ),
    ).toBe(true);
  });
  it("ranking separado y empates con posición compartida", () => {
    const s = setup();
    const rows = leaderboard(s, new Set());
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });
  it("CSV escapa fórmulas y comillas", () => {
    const s = setup();
    s.players.a.nickname = "=1+1";
    expect(csv(s)).toContain("'=1+1");
    expect(csv(s).startsWith("\ufeff")).toBe(true);
  });
  it("contrato estricto rechaza manipulación de rol o puntaje", () => {
    expect(
      actionSchema.safeParse({ ...action(setup(), "a", 0, {}), score: 9999 })
        .success,
    ).toBe(false);
    expect(
      actionSchema.safeParse({ ...action(setup(), "a", 0, {}), role: "admin" })
        .success,
    ).toBe(false);
  });
});
