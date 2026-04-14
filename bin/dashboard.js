#!/usr/bin/env node
/**
 * buildcrew-dashboard CLI entry.
 *
 * Usage:
 *   npx buildcrew-dashboard                       # start server + open browser
 *   npx buildcrew-dashboard --no-open             # start server, don't open browser
 *   npx buildcrew-dashboard --port 4000           # custom port
 *   npx buildcrew-dashboard --install             # install CC hooks (project-local)
 *   npx buildcrew-dashboard --install --global    # install CC hooks (global)
 *   npx buildcrew-dashboard --install --dry-run   # preview install changes
 *   npx buildcrew-dashboard --uninstall           # remove CC hooks (project-local)
 *   npx buildcrew-dashboard --uninstall --global  # remove CC hooks (global)
 *
 * Zero dependencies beyond Node.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../dashboard/server/index.js";
import { install, uninstall } from "../dashboard/server/installer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMIT_SCRIPT = path.resolve(__dirname, "..", "dashboard", "hooks", "emit.js");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const cwd = process.cwd();
const scope = flag("--global") ? "global" : "project";
const dryRun = flag("--dry-run");

if (flag("--install")) {
  await runInstall();
} else if (flag("--uninstall")) {
  await runUninstall();
} else {
  await runServer();
}

// --------------------------------

async function runInstall() {
  try {
    const result = await install({ scope, cwd, emitScript: EMIT_SCRIPT, dryRun });
    console.log("");
    console.log(`  buildcrew dashboard — ${dryRun ? "install (dry run)" : "install"}`);
    console.log("  ────────────────────────────────────────");
    console.log(`  scope:   ${scope}`);
    console.log(`  target:  ${result.settingsPath}`);
    if (result.backupPath) console.log(`  backup:  ${result.backupPath}`);
    console.log("");
    console.log(result.preview);
    console.log("");
    if (result.action === "installed") {
      console.log("  ✓ installed. Start the dashboard with:");
      console.log("      npx buildcrew-dashboard");
      console.log("  Then open any Claude Code session in this directory.");
    } else {
      console.log("  (dry run — no files changed)");
      console.log("  Add --install without --dry-run to apply.");
    }
    console.log("");
  } catch (err) {
    console.error(`  ✗ install failed: ${err.message}`);
    process.exit(1);
  }
}

async function runUninstall() {
  try {
    const result = await uninstall({ scope, cwd, dryRun });
    console.log("");
    console.log(`  buildcrew dashboard — ${dryRun ? "uninstall (dry run)" : "uninstall"}`);
    console.log("  ────────────────────────────────────────");
    console.log(`  scope:   ${scope}`);
    console.log(`  target:  ${result.settingsPath}`);
    if (result.backupPath) console.log(`  backup:  ${result.backupPath}`);
    console.log("");
    console.log(result.preview ?? "  (no changes)");
    console.log("");
    if (result.action === "uninstalled") console.log("  ✓ uninstalled.");
    else if (result.action === "noop") console.log("  (nothing to uninstall)");
    else console.log("  (dry run — no files changed)");
    console.log("");
  } catch (err) {
    console.error(`  ✗ uninstall failed: ${err.message}`);
    process.exit(1);
  }
}

async function runServer() {
  const port = parseInt(value("--port", "3737"), 10);
  const shouldOpen = !flag("--no-open");

  const server = createServer({ cwd, port });
  const { port: boundPort, eventsFile } = await server.start();

  const url = `http://localhost:${boundPort}`;
  console.log("");
  console.log("  buildcrew dashboard");
  console.log("  ────────────────────────────────────────");
  console.log(`  URL:     ${url}`);
  console.log(`  Events:  ${eventsFile}`);
  console.log(`  Schema:  append-only JSONL`);
  console.log("");
  console.log("  Stop: Ctrl+C");
  console.log("");

  if (shouldOpen) openBrowser(url);

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    console.log("\n  stopping…");
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

function openBrowser(targetUrl) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open"
           : platform === "win32" ? "start"
           : "xdg-open";
  const argv = platform === "win32" ? ["", targetUrl] : [targetUrl];
  try {
    spawn(cmd, argv, { stdio: "ignore", detached: true, shell: platform === "win32" }).unref();
  } catch (err) {
    console.warn(`  (could not auto-open browser: ${err.message})`);
  }
}
