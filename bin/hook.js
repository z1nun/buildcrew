#!/usr/bin/env node
/**
 * buildcrew-hook — thin CLI proxy for lib/hook.js.
 *
 * Installed as a bin entry so `npx buildcrew-hook <kind>` resolves
 * the correct path regardless of where the package lives on disk.
 * This keeps settings.json hook commands stable across reinstalls.
 *
 * Critical: hooks MUST silent-fail. If lib/hook.js is missing, malformed,
 * or throws on import, we exit 0 anyway — surfacing an error here would
 * make every Claude Code prompt show a hook failure popup.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const emitPath = path.resolve(__dirname, "..", "lib", "hook.js");

try {
  await import(emitPath);
} catch (err) {
  // Surface to stderr for debugging (BUILDCREW_HOOK_DEBUG=1 only) but never
  // propagate — CC blocks the user's prompt if a hook exits non-zero.
  if (process.env.BUILDCREW_HOOK_DEBUG === "1") {
    try { process.stderr.write(`[buildcrew-hook] import failed: ${err?.message ?? err}\n`); } catch {}
  }
  process.exit(0);
}
