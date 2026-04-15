/**
 * buildcrew CC hook installer.
 *
 * Registers hook entries in .claude/settings.json that invoke
 * `npx buildcrew-hook <kind>` on each agent/file event. The hook writes
 * a styled banner to the terminal AND appends to events.jsonl so that
 * `npx buildcrew watch` can show a live view in a separate pane.
 *
 * Idempotent — re-install replaces prior buildcrew entries without
 * touching other hooks or permissions in the file.
 */

import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";

const BUILDCREW_TAG = "buildcrew-hook";

export function resolveSettingsPath({ scope, cwd }) {
  if (scope === "global") return path.join(os.homedir(), ".claude", "settings.json");
  return path.join(cwd, ".claude", "settings.json");
}

export function resolvePermissionsPath({ scope, cwd }) {
  if (scope === "global") return path.join(os.homedir(), ".claude", "settings.local.json");
  return path.join(cwd, ".claude", "settings.local.json");
}

export function buildcrewHooks() {
  const cmd = (kind) => `npx buildcrew-hook ${kind}`;
  const mk = (kind, matcher) => ({
    [BUILDCREW_TAG]: true,
    ...(matcher ? { matcher } : {}),
    hooks: [{ type: "command", command: cmd(kind) }],
  });
  return {
    PreToolUse: [mk("pre-agent", "Agent")],
    PostToolUse: [
      mk("post-agent", "Agent"),
      mk("file-written", "Write|Edit|MultiEdit"),
    ],
    UserPromptSubmit: [mk("user-prompt")],
    Stop: [mk("session-end")],
  };
}

export function buildcrewPermissions() {
  return {
    allow: [
      "Agent", "Task", "Read", "Glob", "Grep", "Write", "Edit", "MultiEdit",
      "NotebookEdit", "WebFetch", "WebSearch",
      "Bash(npm *)", "Bash(npx *)", "Bash(node *)",
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
      "Bash(git branch*)", "Bash(git show*)", "Bash(git add:*)", "Bash(git commit:*)",
      "Bash(ls *)", "Bash(pwd)", "Bash(which *)",
      "Bash(cat *)", "Bash(head *)", "Bash(tail *)",
      "Bash(mkdir *)", "Bash(touch *)", "Bash(echo *)",
    ],
    deny: [
      "Bash(rm -rf *)", "Bash(sudo *)",
      "Bash(git push --force*)", "Bash(git reset --hard*)",
      "Bash(curl * -X POST*)",
    ],
  };
}

export async function install({ scope = "project", cwd = process.cwd(), withPermissions = false } = {}) {
  const settingsPath = resolveSettingsPath({ scope, cwd });
  const { current, existed } = await readJson(settingsPath);
  const next = mergeHooks(current, buildcrewHooks());

  let permissionsResult = null;
  if (withPermissions) {
    permissionsResult = await installPermissions({ scope, cwd });
  }

  if (existed) await backup(settingsPath);
  await atomicWrite(settingsPath, JSON.stringify(next, null, 2) + "\n");
  return { action: "installed", settingsPath, existed, permissions: permissionsResult };
}

export async function installPermissions({ scope = "project", cwd = process.cwd() } = {}) {
  const permPath = resolvePermissionsPath({ scope, cwd });
  const { current, existed } = await readJson(permPath);
  const rec = buildcrewPermissions();

  const nextPerms = current.permissions && typeof current.permissions === "object"
    ? { ...current.permissions } : {};
  nextPerms.allow = mergeUnique(nextPerms.allow, rec.allow);
  nextPerms.deny = mergeUnique(nextPerms.deny, rec.deny);

  if (existed) await backup(permPath);
  await atomicWrite(permPath, JSON.stringify({ ...current, permissions: nextPerms }, null, 2) + "\n");
  return { action: "installed", permPath, existed };
}

export async function uninstall({ scope = "project", cwd = process.cwd() } = {}) {
  const settingsPath = resolveSettingsPath({ scope, cwd });
  const { current, existed } = await readJson(settingsPath);
  if (!existed) return { action: "noop", reason: "no settings file", settingsPath };
  const next = stripBuildcrewHooks(current);
  await backup(settingsPath);
  await atomicWrite(settingsPath, JSON.stringify(next, null, 2) + "\n");
  return { action: "uninstalled", settingsPath };
}

// ------------ internals ------------

async function readJson(p) {
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
    // Remove prior buildcrew entries to stay idempotent
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
  if (Object.keys(cleaned).length === 0) delete out.hooks;
  else out.hooks = cleaned;
  return out;
}

function mergeUnique(existing, additions) {
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base);
  for (const a of additions) if (!seen.has(a)) { base.push(a); seen.add(a); }
  return base;
}

async function backup(p) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    await fsp.copyFile(p, `${p}.buildcrew-backup-${ts}`);
  } catch { /* best-effort */ }
}

async function atomicWrite(p, content) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  await fsp.writeFile(tmp, content, "utf8");
  await fsp.rename(tmp, p);
}
