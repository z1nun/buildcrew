/**
 * lib/cli/watch.js
 *
 * `npx buildcrew watch` — pass-through to bin/watch.js, the dedicated
 * terminal-native live monitor entrypoint. We spawn it as a child process
 * (rather than importing) so its stdin/stdout TTY handling and exit codes
 * remain identical whether invoked via `buildcrew watch` or `buildcrew-watch`.
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RED, RESET } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runWatch() {
  // bin/watch.js sits at <pkg-root>/bin/watch.js; this file is at
  // <pkg-root>/lib/cli/watch.js → walk up two and into bin/.
  const watchEntry = resolve(__dirname, "..", "..", "bin", "watch.js");
  // Forward CLI args after `buildcrew watch` (process.argv[0] = node,
  // [1] = setup.js, [2] = "watch", so flags start at [3]).
  const passthrough = process.argv.slice(3);
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, [watchEntry, ...passthrough], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    // eslint-disable-next-line no-console -- error channel must reach stderr
    console.error(`${RED}Watch failed to start:${RESET} ${err.message}`);
    process.exit(1);
  });
}
