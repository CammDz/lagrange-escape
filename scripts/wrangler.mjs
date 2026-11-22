import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url)),
  config = fileURLToPath(new URL("../work/config", import.meta.url)),
  logs = fileURLToPath(new URL("../work/logs", import.meta.url));
mkdirSync(config, { recursive: true });
mkdirSync(logs, { recursive: true });
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
    ),
    ...process.argv.slice(2),
  ],
  {
    cwd:
      process.argv[2] === "pages"
        ? fileURLToPath(new URL("../apps/web/", import.meta.url))
        : root,
    stdio: "inherit",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: config,
      WRANGLER_LOG_PATH: logs,
      CLOUDFLARE_SEND_METRICS: "false",
    },
  },
);
child.on("exit", (code) => process.exit(code || 0));
