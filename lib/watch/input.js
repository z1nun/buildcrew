/**
 * lib/watch/input.js — keyboard input + terminal mode management.
 *
 * Two responsibilities:
 *   1. Alt-screen / cursor lifecycle — enter on startup, restore on exit
 *   2. Keypress dispatch — q/Ctrl-C quits, r opens the full coherence report
 *
 * Kept separate from render.js because input has side effects on process
 * state (raw mode, signals) that would otherwise leak into pure rendering.
 */
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALT_SCREEN_ON, ALT_SCREEN_OFF, HIDE_CURSOR, SHOW_CURSOR, scheduleRender } from "./render.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Enter alternate screen so the dashboard doesn't scribble over the user's
 * scrollback. Returns a restore function that callers must wire to exit
 * paths (process.on("exit"), SIGINT, SIGTERM).
 */
export function enterAltScreen() {
  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
  return function restore() {
    process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
  };
}

/**
 * Wire signal handlers so Ctrl-C and SIGTERM restore the terminal before
 * exiting. Without this, quitting mid-render leaves the user stuck in the
 * alt-screen with a hidden cursor.
 */
export function installExitHandlers(restore) {
  process.on("exit", restore);
  process.on("SIGINT", () => { restore(); process.exit(0); });
  process.on("SIGTERM", () => { restore(); process.exit(0); });
}

/**
 * Install keypress listeners. Only active on real TTYs — when stdin is
 * piped (e.g. CI, tests) we silently skip so the dashboard still renders.
 *
 * Keys:
 *   q, Ctrl-C  → quit (restore terminal, exit 0)
 *   r          → spawn `setup.js report` for the full coherence report,
 *                paged via less; on return, re-enter alt screen and redraw
 */
export function installKeypressHandlers() {
  if (!process.stdin.isTTY) return;
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (_str, key) => {
    if (key?.name === "q" || (key?.ctrl && key?.name === "c")) {
      process.stdout.write(SHOW_CURSOR);
      process.exit(0);
    }
    if (key?.name === "r") {
      // Open the full coherence report. Hand off the terminal to setup.js's
      // report subcommand which uses `less -R` for paging. Leave the alt
      // screen so less paints on the main buffer; re-enter on return.
      process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
      process.stdin.setRawMode(false);
      // bin/watch.js is one directory up from lib/watch/input.js, so we
      // resolve setup.js relative to ../../bin/.
      const setupEntry = resolve(__dirname, "..", "..", "bin", "setup.js");
      spawnSync(process.execPath, [setupEntry, "report"], {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
      });
      // Restore raw mode + alt screen + hide cursor + redraw
      process.stdin.setRawMode(true);
      process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
      scheduleRender();
    }
  });
}
