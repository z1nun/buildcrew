#!/usr/bin/env node
/**
 * Claude Code hook handler for buildcrew.
 *
 * Reads the CC hook JSON from stdin and does two things:
 *   1. Prints a compact color-coded banner to the user's terminal so the
 *      agent lifecycle is visible inline with the CC output.
 *   2. Appends the event to .claude/buildcrew/events.jsonl so
 *      `npx buildcrew watch` (or later tooling) can show a live view.
 *
 * Called as:   node dashboard/hooks/emit.js <kind>
 * Kinds:       pre-agent | post-agent | file-written | user-prompt
 *              | subagent-stop | session-end
 *
 * MUST be fast and MUST silent-fail (hooks block Claude Code if they hang).
 */

import { openSync, writeSync, closeSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const kind = process.argv[2];
const EVENTS_PATH = join(process.cwd(), ".claude", "buildcrew", "events.jsonl");

// ------------------------------------------------------------------
// Terminal banner output — writes a compact styled line straight to
// /dev/tty so it appears in the user's CC terminal regardless of how
// the hook process's stdio is captured. NO_COLOR env disables ANSI.
// ------------------------------------------------------------------
const NO_COLOR = !!process.env.NO_COLOR || process.env.BUILDCREW_HOOK_QUIET === "1";
const C = NO_COLOR
  ? new Proxy({}, { get: () => "" })
  : {
      reset: "\x1b[0m",
      bold:  "\x1b[1m",
      dim:   "\x1b[2m",
      red:   "\x1b[31m",
      green: "\x1b[32m",
      gold:  "\x1b[33m",
      blue:  "\x1b[34m",
      mag:   "\x1b[35m",
      cyan:  "\x1b[36m",
      gray:  "\x1b[90m",
    };

const AGENT_EMOJI = {
  buildcrew: "🎩", planner: "📋", designer: "🎨", developer: "💻",
  "qa-tester": "🧪", "browser-qa": "🌐", reviewer: "🧐", "health-checker": "🩺",
  "security-auditor": "🛡", "canary-monitor": "🐤", shipper: "🚢",
  thinker: "🤔", architect: "📐", "design-reviewer": "👀",
  investigator: "🕵", "qa-auditor": "⚖",
};

function writeTTY(line) {
  if (process.env.BUILDCREW_HOOK_QUIET === "1") return;
  let fd;
  try {
    fd = openSync("/dev/tty", "w");
    writeSync(fd, line + "\n");
  } catch {
    // No TTY (CI, pipe, etc.) — fall back to stderr
    try { process.stderr.write(line + "\n"); } catch {}
  } finally {
    if (fd !== undefined) try { closeSync(fd); } catch {}
  }
}

function banner(kind, data) {
  switch (kind) {
    case "pre-agent": {
      const agent = data?.tool_input?.subagent_type ?? "agent";
      const icon = AGENT_EMOJI[agent] ?? "●";
      const prompt = truncate(data?.tool_input?.prompt ?? data?.tool_input?.description ?? "", 90);
      return `${C.gold}▶${C.reset}  ${icon} ${C.bold}${agent}${C.reset} ${C.gray}· ${prompt}${C.reset}`;
    }
    case "post-agent": {
      const agent = data?.tool_input?.subagent_type ?? "agent";
      const icon = AGENT_EMOJI[agent] ?? "●";
      return `${C.green}✓${C.reset}  ${icon} ${C.bold}${agent}${C.reset} ${C.gray}done${C.reset}`;
    }
    case "file-written": {
      const p = data?.tool_input?.file_path;
      if (!p) return null;
      const rel = p.split("/").slice(-2).join("/");
      return `${C.blue}📝${C.reset} ${rel} ${C.gray}(${data?.tool_name ?? "edit"})${C.reset}`;
    }
    case "session-end":
      return `${C.mag}◼${C.reset}  ${C.dim}session ended${C.reset}`;
    default:
      return null; // user-prompt + subagent-stop are too noisy for terminal
  }
}

async function main() {
  if (!kind) process.exit(0);

  // Read stdin (hooks send JSON on stdin)
  let input = "";
  try {
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) input += chunk;
  } catch {
    process.exit(0);
  }

  let data = {};
  if (input.trim()) {
    try { data = JSON.parse(input); } catch { /* ignore malformed */ }
  }

  // Print styled banner to the user's terminal (this is the primary UX now —
  // dashboard HTTP broadcast is optional and only works when server is up).
  try {
    const line = banner(kind, data);
    if (line) writeTTY(line);
  } catch {}

  const events = toEvents(kind, data);
  if (!events.length) process.exit(0);

  // Append events to the JSONL log — silent-fail so hooks never block CC.
  try {
    mkdirSync(join(process.cwd(), ".claude", "buildcrew"), { recursive: true });
    const lines = events
      .map((e) => JSON.stringify({ ...e, at: e.at ?? new Date().toISOString() }))
      .join("\n") + "\n";
    appendFileSync(EVENTS_PATH, lines);
  } catch {
    // Disk full / permission — silently ignore; banner already printed.
  }
  process.exit(0);
}

function toEvents(kind, data) {
  // Every event carries session_id so the dashboard can disambiguate
  // concurrent Claude Code sessions running in the same project.
  const sessionId = data?.session_id ?? "unknown";

  switch (kind) {
    case "pre-agent": {
      const subagent = data?.tool_input?.subagent_type ?? "agent";
      const prompt = truncate(data?.tool_input?.prompt ?? data?.tool_input?.description ?? "", 400);
      return [{
        type: "agent.dispatched",
        agent: subagent, from: "buildcrew", prompt,
        session_id: sessionId,
      }];
    }
    case "post-agent": {
      const subagent = data?.tool_input?.subagent_type ?? "agent";
      const resp = data?.tool_response;
      let summary = "";
      if (typeof resp === "string") summary = resp.slice(0, 500);
      else if (resp?.content?.[0]?.text) summary = String(resp.content[0].text).slice(0, 500);
      return [{
        type: "agent.completed",
        agent: subagent, output_summary: summary,
        session_id: sessionId,
      }];
    }
    case "file-written": {
      const path = data?.tool_input?.file_path;
      if (!path) return [];
      // CC hook payload doesn't include "current subagent" info. We default to
      // "buildcrew" (team lead) so the dashboard HONESTLY reveals when the lead
      // is writing files directly — which is a pipeline violation per Feature
      // mode rules. Dashboard's pipeline-integrity check warns on this.
      return [{
        type: "file.written",
        agent: data?.agent ?? "buildcrew", path,
        tool_name: data?.tool_name,
        session_id: sessionId,
      }];
    }
    case "user-prompt": {
      const sid = sessionId === "unknown" ? `cc-${Date.now()}` : sessionId;
      const events = [{
        type: "session.start",
        session_id: sid,
        mode: "feature",
      }];
      // CC's @mention invocations don't fire PreToolUse:Agent — they spawn
      // subagents directly. Parse @<agent-name> from the prompt so the town
      // shows a bubble when the user routes via @buildcrew (or any agent).
      const prompt = String(data?.prompt ?? "");
      const seen = new Set();
      const mentionRe = /(?:^|\s)@([a-z][a-z0-9-]*)/gi;
      let m;
      while ((m = mentionRe.exec(prompt)) !== null) {
        const name = m[1].toLowerCase();
        if (seen.has(name)) continue;
        seen.add(name);
        events.push({
          type: "agent.dispatched",
          agent: name,
          from: "user",
          prompt: truncate(prompt, 400),
          session_id: sid,
        });
      }
      return events;
    }
    case "subagent-stop": {
      // SubagentStop fires when an @-mention subagent finishes. CC's payload
      // doesn't tell us which agent stopped, so we emit a sweep — the client
      // idles every currently-active agent for this session.
      return [{
        type: "agent.completed",
        agent: null,
        sweep: true,
        session_id: sessionId,
      }];
    }
    case "session-end": {
      return [{
        type: "session.end",
        session_id: sessionId,
        outcome: "success",
      }];
    }
    default:
      return [];
  }
}

function truncate(s, n) {
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

main();
