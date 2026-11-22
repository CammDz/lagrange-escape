import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { admin, request } from "./helpers.mjs";
const auth = await admin();
const created = await request(
  "/rooms",
  { title: "Equipos flexibles", mode: "teams" },
  auth,
);
assert.equal(created.status, 201);
const code = created.data.code;
for (const size of [2, 3, 4]) {
  let team;
  for (let i = 0; i < size; i++) {
    const r = await request(`/rooms/${code}/join`, {
      nickname: `Grupo ${size} persona ${i}`,
      ...(i === 0 ? { newTeam: `Grupo de ${size}` } : { team }),
    });
    assert.equal(r.status, 201);
    const s = await request(`/rooms/${code}/snapshot`);
    team = s.data.teams.find((t) => t.name === `Grupo de ${size}`).id;
  }
}
let s = await request(`/rooms/${code}/snapshot`);
assert.equal(s.data.config.teamSize, 30);
assert.deepEqual(
  s.data.teams.map((t) => t.members.length),
  [2, 3, 4],
);
assert.equal(s.data.players.length, 9);
assert.equal(
  (await request(`/rooms/${code}/control`, { command: "start" }, auth)).status,
  200,
);
assert.equal(
  (await request(`/rooms/${code}/snapshot`)).data.status,
  "countdown",
);
await request(`/rooms/${code}/control`, { command: "finish" }, auth);
const limited = await request(
  "/rooms",
  { title: "Límite opcional", mode: "teams", teamSize: 2 },
  auth,
);
const other = limited.data.code;
await request(`/rooms/${other}/join`, {
  nickname: "Primero",
  newTeam: "Equipo limitado",
});
s = await request(`/rooms/${other}/snapshot`);
const team = s.data.teams[0].id;
assert.equal(
  (await request(`/rooms/${other}/join`, { nickname: "Segundo", team })).status,
  201,
);
assert.equal(
  (await request(`/rooms/${other}/join`, { nickname: "Tercero", team })).status,
  409,
);
const report = {
  passed: true,
  verified: [
    "Equipos de 2, 3 y 4 simultáneos",
    "Inicio sin exigir tamaños iguales ni cupos llenos",
    "Tamaño flexible predeterminado",
    "Límite opcional respetado",
  ],
  participants: 9,
  teamSizes: [2, 3, 4],
};
writeFileSync(
  new URL("../docs/teams-results.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
