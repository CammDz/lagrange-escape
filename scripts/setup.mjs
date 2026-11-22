import { randomBytes, pbkdf2Sync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
const path = new URL("../apps/worker/.dev.vars", import.meta.url);
if (existsSync(path) && !process.argv.includes("--replace")) {
  console.error(".dev.vars ya existe. Conservado.");
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(
  "Configuración local. Usa una contraseña exclusiva para desarrollo.",
);
const password = await rl.question(
  "Contraseña de administración (mínimo 12 caracteres; entrada visible): ",
);
rl.close();
if (password.length < 12) throw Error("Contraseña demasiado corta.");
const salt = randomBytes(24).toString("hex");
const value =
  salt + ":" + pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex");
writeFileSync(path, `ADMIN_PASSWORD_HASH="${value}"\n`);
console.log(
  "Configuración guardada en archivo ignorado. Para producción, usa wrangler secret put ADMIN_PASSWORD_HASH --env production con este mismo formato.",
);
