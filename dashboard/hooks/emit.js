#!/usr/bin/env node
/**
 * Claude Code hook handler for buildcrew dashboard.
 *
 * Receives JSON on stdin (standard CC hook contract), transforms it into a
 * DashboardEvent, and POSTs to the local dashboard server. Designed to be
 * invoked by the hooks in .claude/settings.json.
 *
 * Called as:   node dashboard/hooks/emit.js <kind>
 * Kinds:       pre-agent | post-agent | file-written | user-prompt | session-end
 *
 * MUST be fast and MUST silent-fail (hooks block Claude Code if they hang).
 */

const kind = process.argv[2];
const PORT = process.env.BUILDCREW_DASHBOARD_PORT ?? "3737";
const URL = `http://localhost:${PORT}/emit`;
const TIMEOUT_MS = 500;

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

  const event = toEvent(kind, data);
  if (!event) process.exit(0);

  // POST with short timeout, silent fail — never block Claude Code
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: ctrl.signal,
    });
  } catch {
    // Dashboard not running or slow — intentionally silent
  } finally {
    clearTimeout(to);
  }
  process.exit(0);
}

function toEvent(kind, data) {
  // Every event carries session_id so the dashboard can disambiguate
  // concurrent Claude Code sessions running in the same project.
  const sessionId = data?.session_id ?? "unknown";

  switch (kind) {
    case "pre-agent": {
      const subagent = data?.tool_input?.subagent_type ?? "agent";
      const prompt = truncate(data?.tool_input?.prompt ?? data?.tool_input?.description ?? "", 400);
      return {
        type: "agent.dispatched",
        agent: subagent, from: "buildcrew", prompt,
        session_id: sessionId,
      };
    }
    case "post-agent": {
      const subagent = data?.tool_input?.subagent_type ?? "agent";
      const resp = data?.tool_response;
      let summary = "";
      if (typeof resp === "string") summary = resp.slice(0, 500);
      else if (resp?.content?.[0]?.text) summary = String(resp.content[0].text).slice(0, 500);
      return {
        type: "agent.completed",
        agent: subagent, output_summary: summary,
        session_id: sessionId,
      };
    }
    case "file-written": {
      const path = data?.tool_input?.file_path;
      if (!path) return null;
      // CC hook payload doesn't include "current subagent" info. We default to
      // "buildcrew" (team lead) so the dashboard HONESTLY reveals when the lead
      // is writing files directly — which is a pipeline violation per Feature
      // mode rules. Dashboard's pipeline-integrity check warns on this.
      return {
        type: "file.written",
        agent: data?.agent ?? "buildcrew", path,
        tool_name: data?.tool_name,
        session_id: sessionId,
      };
    }
    case "user-prompt": {
      return {
        type: "session.start",
        session_id: sessionId === "unknown" ? `cc-${Date.now()}` : sessionId,
        mode: "feature",
      };
    }
    case "session-end": {
      return {
        type: "session.end",
        session_id: sessionId,
        outcome: "success",
      };
    }
    default:
      return null;
  }
}

function truncate(s, n) {
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

main();
