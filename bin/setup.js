#!/usr/bin/env node
/**
 * buildcrew — main CLI entrypoint.
 *
 * This file is intentionally a thin argv router. Every subcommand lives in
 * lib/cli/*.js so each one is independently testable and the entrypoint
 * stays scannable. New subcommands: add a route below + a module under lib/cli/.
 *
 * Subcommand routing precedence:
 *   1. --version / -v        → print version and exit
 *   2. --help / -h           → print help and exit
 *   3. positional command    → init | add | harness | watch | report
 *   4. --list / -l           → list agents
 *   5. --uninstall           → remove agents
 *   6. (default)             → install agents
 *
 * Subcommand routing takes priority over global flags so that
 * `report --list` resolves to runReport (not runList).
 */

import { runInit } from "../lib/cli/init.js";
import { runAdd, runHarnessStatus } from "../lib/cli/add.js";
import { runInstall, runUninstall } from "../lib/cli/install.js";
import { runList } from "../lib/cli/list.js";
import { runWatch } from "../lib/cli/watch.js";
import { runReport } from "../lib/cli/report.js";
import { runHelp, runVersion } from "../lib/cli/help.js";
import { RED, RESET } from "../lib/cli/utils.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];
  const force = args.includes("--force") || args.includes("-f");

  if (args.includes("--version") || args.includes("-v")) return runVersion();
  if (args.includes("--help") || args.includes("-h")) return runHelp();

  // Subcommand routing takes priority over global --list (so `report --list` works)
  if (command === "init") return runInit(force);
  if (command === "add") return runAdd(subcommand, force);
  if (command === "harness") return runHarnessStatus();
  if (command === "watch") return runWatch();
  if (command === "report") return runReport();
  if (args.includes("--list") || args.includes("-l")) return runList();
  if (args.includes("--uninstall")) return runUninstall();

  return runInstall(force);
}

main().catch(err => {
  // Error channel must reach stderr — file is in eslint.config.js no-console override.
  console.error(`${RED}Error:${RESET} ${err.message}`);
  process.exit(1);
});
