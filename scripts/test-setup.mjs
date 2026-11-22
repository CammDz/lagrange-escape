import { randomBytes, pbkdf2Sync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const path = new URL("../apps/worker/.dev.vars", import.meta.url);
if (existsSync(path)) {
  console.log(
    "Credenciales existentes conservadas. Define TEST_ADMIN_PASSWORD para pruebas.",
  );
  process.exit(0);
}
const password = randomBytes(24).toString("base64url"),
  salt = randomBytes(24).toString("hex");
mkdirSync(new URL("../work", import.meta.url), { recursive: true });
writeFileSync(
  path,
  `ADMIN_PASSWORD_HASH="${salt}:${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex")}"\n`,
);
writeFileSync(
  new URL("../work/test-auth.json", import.meta.url),
  JSON.stringify({ password }),
);
console.log(
  "Credenciales de prueba generadas en archivos locales ignorados. No se imprimen secretos.",
);
