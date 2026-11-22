import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  admin,
  request,
  client,
  solve,
  delay,
  correctPiece,
} from "./helpers.mjs";
const started = Date.now(),
  adminCookie = await admin();
const r = await request(
  "/rooms",
  {
    title: "Carga real 30 exploradores",
    duration: 5,
    mode: "mixed",
    maxPlayers: 30,
    teamSize: 5,
    allowTeams: true,
    hints: true,
    sound: false,
    ranking: true,
  },
  adminCookie,
);
assert.equal(r.status, 201);
const code = r.data.code,
  clients = [],
  cookies = [];
let expectedSecurityErrors = 0;
console.log("Sala creada. Conectando 30 dispositivos WebSocket reales.");
assert.equal(
  (await request(`/rooms/${code}/control`, { command: "start" })).status,
  401,
);
for (let i = 0; i < 30; i++) {
  let membership = {};
  if (i >= 15) {
    const group = Math.floor((i - 15) / 5);
    if ((i - 15) % 5 === 0) membership = { newTeam: "Equipo " + group };
    else {
      const state = await request(`/rooms/${code}/snapshot`);
      membership = {
        team: state.data.teams.find((t) => t.name === "Equipo " + group).id,
      };
    }
  }
  const joined = await request(`/rooms/${code}/join`, {
    nickname: "Explorador " + i,
    ...membership,
  });
  assert.equal(joined.status, 201);
  cookies.push(joined.cookie);
  clients.push(await client(code, joined.cookie));
}
assert.equal(clients.length, 30);
const control = async (command) => {
  const result = await request(
    `/rooms/${code}/control`,
    { command },
    adminCookie,
  );
  assert.equal(result.status, 200);
};
await control("start");
await Promise.all(clients.map((c) => c.wait((s) => s.status === "running")));
console.log(
  "30 clientes recibieron el inicio. Pausando y verificando bloqueo.",
);
const initialRemaining = clients.map((c) => c.snap.remaining);
assert.ok(Math.max(...initialRemaining) - Math.min(...initialRemaining) < 2000);
await control("pause");
await clients[0].wait((s) => s.status === "paused");
const before = clients[0].snap.progress.correct;
await clients[0].send(
  "answer",
  { target: "objective", piece: correctPiece(clients[0].snap, "objective") },
  0,
);
expectedSecurityErrors++;
assert.equal(clients[0].snap.progress.correct, before);
await delay(1200);
await control("resume");
await clients[0].wait((s) => s.status === "running");
await Promise.all(
  clients
    .slice(15, 20)
    .map((c) =>
      c.send(
        "answer",
        { target: "variables", piece: correctPiece(c.snap, "variables") },
        0,
      ),
    ),
);
await clients[15].wait((s) => s.progress.correct === 1);
assert.equal(clients[15].snap.progress.correct, 1);
console.log(
  "Concurrencia de equipo sin duplicación verificada. Resolviendo las cuatro cámaras.",
);
await Promise.all(
  [...clients.slice(0, 15), clients[15], clients[20], clients[25]].map(solve),
);
await clients[29].wait((s) => s.progress.stage === 4);
for (const c of clients) assert.equal(c.snap.progress.score, 1100);
clients[0].ws.close();
await delay(200);
clients[0] = await client(code, cookies[0]);
assert.equal(clients[0].snap.progress.stage, 4);
assert.equal(clients[0].snap.progress.score, 1100);
// Invalid role/score never enter the typed protocol.
clients[1].ws.send(
  JSON.stringify({
    v: 1,
    id: crypto.randomUUID(),
    seq: 999,
    type: "answer",
    stage: 0,
    data: {},
    role: "admin",
    score: 999999,
  }),
);
expectedSecurityErrors++;
await delay(200);
console.log(
  "Reconexión restaurada. Esperando cierre automático de los 5 minutos efectivos.",
);
while (clients[0].snap.status !== "finished") {
  await delay(10000);
  if (Date.now() - started > 370000)
    throw Error("No hubo finalización automática.");
}
await Promise.all(clients.map((c) => c.wait((s) => s.status === "finished")));
const final = await request(`/rooms/${code}/snapshot`, undefined, adminCookie);
assert.equal(
  final.data.leaderboard.filter((r) => r.category === "individual").length,
  15,
);
assert.equal(
  final.data.leaderboard.filter((r) => r.category === "team").length,
  3,
);
assert.ok(final.data.leaderboard.every((r) => r.score === 1100));
const exported = await request(`/rooms/${code}/export`, undefined, adminCookie);
assert.equal(exported.status, 200);
assert.ok(exported.data.includes("1100"));
const all = clients.flatMap((c) => c.latencies).sort((a, b) => a - b);
const unexpected = clients
  .flatMap((c) => c.errors)
  .filter((x) => !x.includes("bloqueadas") && !x.includes("Unrecognized key"));
assert.equal(unexpected.length, 0);
const report = {
  environment: "Wrangler local + Vite, sin garantía de latencia WAN",
  code,
  participants: 30,
  individuals: 15,
  teams: 3,
  durationMinutes: 5,
  elapsedMs: Date.now() - started,
  actions: clients.reduce((n, c) => n + c.sent, 0),
  latencyMs: {
    p50: all[Math.floor(all.length * 0.5)],
    p95: all[Math.floor(all.length * 0.95)],
    max: all.at(-1),
  },
  expectedSecurityErrors,
  unexpectedErrors: unexpected,
  verified: [
    "inicio sincronizado",
    "pausa global",
    "bloqueo en pausa",
    "equipos concurrentes sin puntaje duplicado",
    "cuatro cámaras",
    "reconexión",
    "cierre por alarma",
    "clasificación y podio oficiales",
    "CSV",
  ],
};
writeFileSync(
  new URL("../docs/load-results.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
for (const c of clients) c.ws.close();
