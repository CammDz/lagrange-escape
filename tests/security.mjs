import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { admin, request, client, base, delay } from "./helpers.mjs";
const checks = [],
  ok = (name) => {
    checks.push(name);
    console.log("PASS", name);
  };
const auth = await admin(),
  config = {
    title: "Seguridad integración",
    duration: 10,
    mode: "mixed",
    maxPlayers: 30,
    teamSize: 5,
    allowTeams: true,
    hints: true,
    sound: false,
    ranking: false,
  };
const created = await request("/rooms", config, auth);
assert.equal(created.status, 201);
const code = created.data.code;
assert.equal((await request("/rooms")).status, 401);
assert.equal((await request(`/rooms/${code}/export`)).status, 401);
assert.equal(
  (await request(`/rooms/${code}/control`, { command: "start" })).status,
  401,
);
ok("Administración e historial rechazan acceso anónimo");
let response = await fetch(base + "/api/rooms", {
  method: "POST",
  headers: {
    Origin: "https://evil.example",
    Cookie: auth,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(config),
});
assert.equal(response.status, 403);
response = await fetch(base + "/api/rooms", {
  method: "POST",
  headers: { Cookie: auth, "Content-Type": "application/json" },
  body: JSON.stringify(config),
});
assert.equal(response.status, 403);
ok("CSRF: origen incorrecto o ausente rechazado");
response = await fetch(base + `/api/rooms/${code}/control`, {
  method: "POST",
  headers: {
    Origin: new URL(base).origin,
    "Content-Type": "application/json",
    "X-Role": "admin",
  },
  body: JSON.stringify({ command: "start" }),
});
assert.equal(response.status, 401);
ok("Cabeceras de rol falsificadas no elevan permisos");
const one = await request(`/rooms/${code}/join`, { nickname: "Identidad uno" });
assert.equal(one.status, 201);
const session = one.cookie;
assert.equal(
  (await request(`/rooms/${code}/join`, { nickname: "Identidad uno" })).status,
  409,
);
assert.equal(
  (
    await request(
      `/rooms/${code}/session`,
      undefined,
      session.slice(0, -1) + "X",
    )
  ).status,
  401,
);
ok("Apodos duplicados y credenciales manipuladas rechazados");
const room2 = await request("/rooms", { ...config, title: "Otra sala" }, auth);
assert.equal(
  (await request(`/rooms/${room2.data.code}/session`, undefined, session))
    .status,
  401,
);
ok("Una credencial no permite asumir identidad en otra sala");
const publicView = await request(`/rooms/${code}/snapshot`);
assert.equal(publicView.data.progress, undefined);
assert.equal(publicView.data.problem, undefined);
assert.deepEqual(publicView.data.leaderboard, []);
assert.ok(!JSON.stringify(publicView.data).includes("tokenHash"));
ok("Proyección pública sin secretos, soluciones o clasificación oculta");
const first = await client(code, session);
const second = await client(code, session);
await delay(200);
assert.ok(first.ws.readyState === 2 || first.ws.readyState === 3);
first.ws.terminate();
ok("Una segunda pestaña reemplaza la conexión autoritativa");
await request(`/rooms/${code}/control`, { command: "start" }, auth);
await second.wait((s) => s.status === "running");
assert.equal(
  (await request(`/rooms/${code}/config`, config, auth)).status,
  400,
);
ok("Configuración de una partida iniciada permanece bloqueada");
const before = second.snap.progress.score;
second.ws.send(
  JSON.stringify({
    v: 1,
    id: crypto.randomUUID(),
    seq: 1,
    type: "answer",
    stage: 0,
    data: {},
    score: 999999,
    role: "admin",
  }),
);
await delay(150);
assert.equal(second.snap.progress.score, before);
assert.ok(second.errors.length > 0);
ok("Protocolo rechaza puntaje o rol introducido por el cliente");
const a = {
  v: 1,
  id: crypto.randomUUID(),
  seq: second.snap.nextSeq,
  type: "answer",
  stage: 0,
  data: {
    target: "objective",
    piece: second.snap.problem.pieces.find((c) => c.label === "f(x,y) = xy").id,
  },
};
second.ws.send(JSON.stringify(a));
await second.wait((s) => s.progress.correct === 1);
second.ws.send(JSON.stringify(a));
await delay(150);
assert.equal(second.snap.progress.correct, 1);
ok("Repetición de acción no duplica aciertos");
assert.equal(
  (await request(`/rooms/${code}/kick`, { id: one.data.id }, auth)).status,
  409,
);
assert.equal(
  (await request(`/rooms/${code}/session`, undefined, session)).status,
  200,
);
const waitingCode = room2.data.code;
const guest = await request(`/rooms/${waitingCode}/join`, {
  nickname: "Expulsión previa",
});
assert.equal(guest.status, 201);
assert.equal(
  (await request(`/rooms/${waitingCode}/kick`, { id: guest.data.id }, auth))
    .status,
  200,
);
assert.equal(
  (await request(`/rooms/${waitingCode}/session`, undefined, guest.cookie))
    .status,
  401,
);
ok("Expulsión bloqueada en curso e invalidada antes del inicio");
await request(`/rooms/${code}/control`, { command: "finish" }, auth);
assert.equal(
  (await request(`/rooms/${code}/kick`, { id: one.data.id }, auth)).status,
  409,
);
await request(`/rooms/${code}/delete`, {}, auth);
await request(`/rooms/${waitingCode}/delete`, {}, auth);
await request("/logout", {}, auth);
assert.equal((await request("/rooms", undefined, auth)).status, 401);
ok("Cerrar sesión revoca el token administrativo en servidor");
second.ws.close();
first.ws.close();
writeFileSync(
  new URL("../docs/security-results.json", import.meta.url),
  JSON.stringify(
    { environment: "Wrangler local + Vite", passed: checks.length, checks },
    null,
    2,
  ),
);
