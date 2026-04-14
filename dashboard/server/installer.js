/**
 * Claude Code settings.json installer for buildcrew dashboard hooks.
 *
 * Safely adds/removes hooks without disturbing existing permissions, mcpServers,
 * or other sections. Always creates a timestamped backup before writing.
 *
 * Scope options:
 *   project (default): <cwd>/.claude/settings.json
 *   global:            ~/.claude/settings.json
 */

import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";

const BUILDCREW_TAG = "buildcrew-dashboard";

/**
 * @param {{ scope: "project"|"global", cwd: string, emitScript: string }} opts
 * @returns {string} absolute path
 */
export function resolveSettingsPath({ scope, cwd }) {
  if (scope === "global") return path.join(os.homedir(), ".claude", "settings.json");
  return path.join(cwd, ".claude", "settings.json");
}

/**
 * Permissions file lives in settings.local.json (user-scoped, gitignored).
 */
export function resolvePermissionsPath({ scope, cwd }) {
  if (scope === "global") return path.join(os.homedir(), ".claude", "settings.local.json");
  return path.join(cwd, ".claude", "settings.local.json");
}

/**
 * Buildcrew-recommended permission allow/deny lists.
 * Covers common subagent operations. Dangerous Bash patterns denied.
 */
export function buildcrewPermissions() {
  return {
    allow: [
      "Agent",
      "Task",
      "Read",
      "Glob",
      "Grep",
      "Write",
      "Edit",
      "MultiEdit",
      "NotebookEdit",
      "WebFetch",
      "WebSearch",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(git status*)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git branch*)",
      "Bash(git show*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(ls *)",
      "Bash(pwd)",
      "Bash(which *)",
      "Bash(cat *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(mkdir *)",
      "Bash(touch *)",
      "Bash(echo *)",
    ],
    deny: [
      "Bash(rm -rf *)",
      "Bash(sudo *)",
      "Bash(git push --force*)",
      "Bash(git reset --hard*)",
      "Bash(curl * -X POST*)",
    ],
  };
}

/**
 * Construct the hooks section buildcrew owns.
 * Each entry is tagged with `buildcrew-dashboard` for idempotent removal.
 * @param {string} emitScript Absolute path to dashboard/hooks/emit.js
 */
export function buildcrewHooks(emitScript) {
  const q = (p) => `"${p.replace(/"/g, '\\"')}"`;
  const cmd = (kind) => `node ${q(emitScript)} ${kind}`;
  const mk = (kind, matcher) => ({
    [BUILDCREW_TAG]: true,
    ...(matcher ? { matcher } : {}),
    hooks: [{ type: "command", command: cmd(kind) }],
  });
  return {
    PreToolUse: [ mk("pre-agent", "Agent") ],
    PostToolUse: [
      mk("post-agent", "Agent"),
      mk("file-written", "Write|Edit|MultiEdit"),
    ],
    UserPromptSubmit: [ mk("user-prompt") ],
    Stop: [ mk("session-end") ],
  };
}

/**
 * @param {{ scope?: "project"|"global", cwd?: string, emitScript: string, dryRun?: boolean, withPermissions?: boolean }} opts
 */
export async function install(opts) {
  const scope = opts.scope ?? "project";
  const cwd = opts.cwd ?? process.cwd();
  const emitScript = opts.emitScript;
  if (!emitScript) throw new Error("emitScript is required");

  const settingsPath = resolveSettingsPath({ scope, cwd });
  const { current, existed } = await readSettings(settingsPath);

  const next = mergeHooks(current, buildcrewHooks(emitScript));
  const preview = formatDiff(current, next, settingsPath);

  // Optional: write recommended permissions to settings.local.json
  let permissionsResult = null;
  if (opts.withPermissions) {
    permissionsResult = await installPermissions({ scope, cwd, dryRun: opts.dryRun });
  }

  if (opts.dryRun) {
    return { action: "dry-run", settingsPath, preview, existed, permissions: permissionsResult };
  }

  const backupPath = existed ? await backup(settingsPath) : null;
  await atomicWrite(settingsPath, JSON.stringify(next, null, 2) + "\n");
  return { action: "installed", settingsPath, backupPath, preview, existed, permissions: permissionsResult };
}

/**
 * Merge recommended allow/deny into .claude/settings.local.json.
 * Idempotent: does not duplicate existing entries.
 */
export async function installPermissions({ scope = "project", cwd = process.cwd(), dryRun = false }) {
  const permPath = resolvePermissionsPath({ scope, cwd });
  const { current, existed } = await readSettings(permPath);
  const rec = buildcrewPermissions();

  const nextPerms = current.permissions && typeof current.permissions === "object"
    ? { ...current.permissions }
    : {};
  const mergedAllow = mergeUnique(nextPerms.allow, rec.allow);
  const mergedDeny = mergeUnique(nextPerms.deny, rec.deny);
  nextPerms.allow = mergedAllow;
  nextPerms.deny = mergedDeny;

  const next = { ...current, permissions: nextPerms };
  const preview = formatPermDiff(current?.permissions ?? {}, nextPerms, permPath);

  if (dryRun) return { action: "dry-run", permPath, preview, existed };

  const backupPath = existed ? await backup(permPath) : null;
  await atomicWrite(permPath, JSON.stringify(next, null, 2) + "\n");
  return { action: "installed", permPath, backupPath, preview, existed };
}

function mergeUnique(existing, additions) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base);
  for (const a of additions) {
    if (!seen.has(a)) { base.push(a); seen.add(a); }
  }
  return base;
}

function formatPermDiff(before, after, filePath) {
  const a = JSON.stringify(before ?? {}, null, 2);
  const b = JSON.stringify(after ?? {}, null, 2);
  if (a === b) return "  (no change to permissions)";
  return [
    `  file: ${filePath}`,
    "  ---- BEFORE permissions ----",
    indent(a),
    "  ---- AFTER permissions ----",
    indent(b),
  ].join("\n");
}

/**
 * @param {{ scope?: "project"|"global", cwd?: string, dryRun?: boolean }} opts
 */
export async function uninstall(opts) {
  const scope = opts.scope ?? "project";
  const cwd = opts.cwd ?? process.cwd();
  const settingsPath = resolveSettingsPath({ scope, cwd });
  const { current, existed } = await readSettings(settingsPath);
  if (!existed) return { action: "noop", reason: "no settings file", settingsPath };

  const next = stripBuildcrewHooks(current);
  const preview = formatDiff(current, next, settingsPath);

  if (opts.dryRun) {
    return { action: "dry-run", settingsPath, preview, existed };
  }

  const backupPath = await backup(settingsPath);
  await atomicWrite(settingsPath, JSON.stringify(next, null, 2) + "\n");
  return { action: "uninstalled", settingsPath, backupPath, preview };
}

// ------------ internals ------------

async function readSettings(p) {
  try {
    const buf = await fsp.readFile(p, "utf8");
    return { current: JSON.parse(buf), existed: true };
  } catch (err) {
    if (err.code === "ENOENT") return { current: {}, existed: false };
    throw new Error(`failed to read ${p}: ${err.message}`);
  }
}

function mergeHooks(current, add) {
  const out = { ...current };
  const existing = out.hooks && typeof out.hooks === "object" ? { ...out.hooks } : {};
  for (const [event, entries] of Object.entries(add)) {
    const prev = Array.isArray(existing[event]) ? existing[event] : [];
    // Remove any prior buildcrew-tagged entries to avoid duplicates on re-install
    const filtered = prev.filter((e) => !(e && e[BUILDCREW_TAG]));
    existing[event] = [...filtered, ...entries];
  }
  out.hooks = existing;
  return out;
}

function stripBuildcrewHooks(current) {
  const out = { ...current };
  if (!out.hooks || typeof out.hooks !== "object") return out;
  const cleaned = {};
  for (const [event, entries] of Object.entries(out.hooks)) {
    if (!Array.isArray(entries)) { cleaned[event] = entries; continue; }
    const filtered = entries.filter((e) => !(e && e[BUILDCREW_TAG]));
    if (filtered.length > 0) cleaned[event] = filtered;
  }
  if (Object.keys(cleaned).length === 0) {
    delete out.hooks;
  } else {
    out.hooks = cleaned;
  }
  return out;
}

async function backup(p) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${p}.buildcrew-backup-${ts}`;
  await fsp.copyFile(p, bak);
  return bak;
}

async function atomicWrite(p, content) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, content, "utf8");
  await fsp.rename(tmp, p);
}

function formatDiff(before, after, filePath) {
  const a = JSON.stringify(before.hooks ?? null, null, 2);
  const b = JSON.stringify(after.hooks ?? null, null, 2);
  if (a === b) return "  (no change to hooks)";
  return [
    `  file: ${filePath}`,
    "  ---- BEFORE hooks ----",
    indent(a),
    "  ---- AFTER hooks ----",
    indent(b),
  ].join("\n");
}

function indent(s) {
  return s.split("\n").map((l) => "  " + l).join("\n");
}
