/**
 * lib/cli/utils.js
 *
 * Shared CLI utilities: ANSI palette, terminal logger, fs/prompt helpers,
 * and the common path/version constants used by every subcommand module.
 *
 * Keep this file dependency-free (only node:* + node_modules). Subcommand
 * modules under lib/cli/ import from here so bin/setup.js can stay thin.
 */

import { access, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── ANSI palette ───
// The CLI is intentionally chromatic — colors are part of the UX. Files that
// import these may opt to swallow them in non-TTY contexts; today we always
// emit them (matches the original behavior of bin/setup.js).
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const CYAN = "\x1b[36m";
export const MAGENTA = "\x1b[35m";
export const RED = "\x1b[31m";

// ─── Path constants ───
// Resolve the package root from this file. lib/cli/utils.js → ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(__dirname, "..", "..");
export const AGENTS_SRC = join(PACKAGE_ROOT, "agents");
export const TEMPLATES_SRC = join(PACKAGE_ROOT, "templates");

// CWD-relative paths (resolved at module load time — fine because the CLI is
// invoked once per process and never changes cwd).
export const TARGET_DIR = join(process.cwd(), ".claude", "agents");
export const HARNESS_DIR = join(process.cwd(), ".claude", "harness");

// Lazy-loaded version (read once on first access). Exposed via getVersion()
// so tests can avoid touching the filesystem at module load.
let _version = null;
export async function getVersion() {
  if (_version !== null) return _version;
  const pkg = JSON.parse(
    await readFile(join(PACKAGE_ROOT, "package.json"), "utf-8"),
  );
  _version = pkg.version;
  return _version;
}

// ─── Logger ───
// Single point of truth for CLI output. Tests can stub this via vi.spyOn(console).
// eslint-disable-next-line no-console -- intentional CLI output channel
export function log(msg) { console.log(msg); }

// ─── fs helpers ───
export async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

// ─── Interactive prompt ───
// Returns the answer trimmed + lowercased. Caller decides what counts as yes/no.
export async function ask(question) {
  const { createInterface } = await import("node:readline");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}
