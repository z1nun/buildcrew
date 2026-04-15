#!/usr/bin/env node
/**
 * buildcrew-hook — thin CLI proxy for lib/hook.js.
 *
 * Installed as a bin entry so `npx buildcrew-hook <kind>` resolves
 * the correct path regardless of where the package lives on disk.
 * This keeps settings.json hook commands stable across reinstalls.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const emitPath = path.resolve(__dirname, "..", "lib", "hook.js");

await import(emitPath);
