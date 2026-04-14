#!/usr/bin/env node
/**
 * buildcrew-dashboard CLI entry.
 *
 * Usage:
 *   npx buildcrew-dashboard              # start server + open browser
 *   npx buildcrew-dashboard --no-open    # start server, don't open browser
 *   npx buildcrew-dashboard --port 4000  # custom port
 *
 * Zero dependencies beyond Node.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../dashboard/server/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const port = parseInt(value("--port", "3737"), 10);
const shouldOpen = !flag("--no-open");
const cwd = process.cwd();

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

// graceful shutdown
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

function openBrowser(targetUrl) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open"
           : platform === "win32" ? "start"
           : "xdg-open";
  const args = platform === "win32" ? ["", targetUrl] : [targetUrl];
  try {
    spawn(cmd, args, { stdio: "ignore", detached: true, shell: platform === "win32" }).unref();
  } catch (err) {
    console.warn(`  (could not auto-open browser: ${err.message})`);
  }
}
