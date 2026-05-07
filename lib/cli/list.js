/**
 * lib/cli/list.js
 *
 * `npx buildcrew --list` — pretty-print every agent in the package with its
 * name, model, and short description (extracted from frontmatter).
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getVersion, log,
  AGENTS_SRC,
  BOLD, DIM, MAGENTA, RESET,
} from "./utils.js";

export async function runList() {
  const VERSION = await getVersion();
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));
  log(`\n  ${BOLD}buildcrew${RESET} v${VERSION} — ${files.length} agents\n`);

  for (const file of files) {
    const content = await readFile(join(AGENTS_SRC, file), "utf8");
    const name = (content.match(/^name:\s*(.+)$/m) || [])[1] || file.replace(".md", "");
    const desc = (content.match(/^description:\s*(.+)$/m) || [])[1] || "";
    const model = (content.match(/^model:\s*(.+)$/m) || [])[1] || "sonnet";
    // Highlight opus models — they're the heavy hitters and useful to spot
    // at a glance when scanning the team.
    const modelTag = model === "opus" ? `${MAGENTA}opus${RESET}` : `${DIM}sonnet${RESET}`;
    log(`  ${name === "buildcrew" ? BOLD : ""}${name.padEnd(20)}${RESET} ${modelTag}  ${DIM}${desc.slice(0, 55)}${RESET}`);
  }
  log("");
}
