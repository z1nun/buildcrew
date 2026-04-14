/**
 * Log panel — DOM sidebar on the right.
 * Renders every DashboardEvent as a readable line.
 * Shows the actual content: prompts, file paths, issue titles, summaries.
 *
 * Controls:
 *   - Filter by agent (dropdown, populated from events seen)
 *   - Filter by type (all / agent / file / issue)
 *   - Click row → expand full JSON
 *   - Agent click in canvas → filter to that agent
 */

import { session } from "./state/session.js";
import { openIssueModal, openAgentPanel, toast } from "./modals.js";
import { isPaused } from "./controls.js";
import { dispatchLine, completeLine, issueLine, stageLine, agentEmoji } from "./voices.js";

const MAX_ROWS = 500;

const TYPE_COLORS = {
  "session.start":    "#a8d994",
  "session.end":      "#c9a876",
  "pipeline.stage":   "#ffd966",
  "agent.dispatched": "#7ee0a2",
  "agent.completed":  "#c9a876",
  "file.written":     "#5aa9ff",
  "issue.found":      "#ff8566",
};

const SEVERITY_BG = {
  critical: "#4a1c18",
  high:     "#3c2818",
  med:      "#3c2818",
  low:      "#2a2420",
};

export function mountLogPanel() {
  const container = document.getElementById("logpanel");
  if (!container) return;

  container.innerHTML = `
    <div class="lp-project" id="lp-project">
      <span class="lp-project-icon">📁</span>
      <span class="lp-project-path" id="lp-project-path" title="project directory">—</span>
    </div>
    <div class="lp-session-tabs" id="lp-session-tabs">
      <button class="lp-session-chip active" data-session="">All</button>
    </div>
    <div class="lp-header">
      <div class="lp-tabs">
        <button class="lp-tab active" data-mode="events">📋 Events</button>
        <button class="lp-tab" data-mode="dialogue">💬 Dialogue</button>
        <button class="lp-tab" data-mode="terminal">⌨ Terminal</button>
      </div>
      <div class="lp-controls">
        <select id="lp-agent-filter"><option value="">all agents</option></select>
        <select id="lp-type-filter">
          <option value="">all types</option>
          <option value="agent">agent events</option>
          <option value="file">file writes</option>
          <option value="issue">issues only</option>
        </select>
        <button id="lp-clear" title="clear filter">reset</button>
      </div>
    </div>
    <div class="lp-meta" id="lp-meta">0 events</div>
    <div class="lp-rows" id="lp-rows"></div>
    <div class="lp-input-area">
      <div class="lp-input-row">
        <span class="lp-input-prompt">❯</span>
        <input id="cmd-input" type="text" placeholder="@buildcrew ..." autocomplete="off" spellcheck="false" />
        <button id="cmd-send">RUN</button>
      </div>
      <div class="lp-input-status" id="cmd-status">idle</div>
    </div>
  `;
  document.body.dataset.tab = "events";

  const rowsEl = document.getElementById("lp-rows");
  const metaEl = document.getElementById("lp-meta");
  const agentFilterEl = document.getElementById("lp-agent-filter");
  const typeFilterEl = document.getElementById("lp-type-filter");
  const sessionTabsEl = document.getElementById("lp-session-tabs");
  const clearBtn = document.getElementById("lp-clear");

  const state = {
    events: [],       // most recent first
    terminal: [],     // chronological (oldest first)
    agents: new Set(),
    sessionIds: new Set(),
    agentFilter: "",
    typeFilter: "",
    sessionFilter: "",
    mode: "events",   // "events" | "dialogue" | "terminal"
  };

  function render() {
    if (state.mode === "dialogue") return renderDialogue();
    if (state.mode === "terminal") return renderTerminal();

    const filtered = state.events.filter(passesFilter);
    metaEl.textContent =
      `${filtered.length} / ${state.events.length} events` +
      (state.agentFilter ? ` · ${state.agentFilter}` : "") +
      (state.typeFilter ? ` · ${state.typeFilter}` : "");

    rowsEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const ev of filtered.slice(0, 200)) {
      frag.appendChild(renderRow(ev));
    }
    rowsEl.appendChild(frag);
  }

  function renderDialogue() {
    // Only show conversation-worthy events, in chronological order
    const convo = state.events
      .filter((ev) =>
        ev.type === "agent.dispatched" ||
        ev.type === "agent.completed" ||
        ev.type === "issue.found" ||
        ev.type === "pipeline.stage" ||
        ev.type === "session.start" ||
        ev.type === "session.end")
      .filter((ev) => !state.sessionFilter || ev.session_id === state.sessionFilter)
      .filter((ev) => !state.agentFilter || ev.agent === state.agentFilter || (ev.type === "agent.dispatched" && ev.from === state.agentFilter))
      .reverse(); // oldest first, like a chat log

    // Surface pipeline integrity warnings at the top of the dialogue
    const warnings = state.sessionFilter
      ? session.sessionWarnings(state.sessionFilter)
      : session.allWarnings();
    metaEl.textContent = `💬 ${convo.length} lines of team dialogue` +
      (state.agentFilter ? ` · ${state.agentFilter} only` : "") +
      (warnings.length ? ` · ⚠ ${warnings.length} warning` + (warnings.length > 1 ? "s" : "") : "");

    rowsEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    // Render warnings at the top so they're impossible to miss
    for (const w of warnings) {
      const warn = document.createElement("div");
      warn.className = "lp-bubble lp-bubble-warning";
      warn.innerHTML = `
        <div class="lp-bubble-ts">⚠ ${esc(w.kind)}${w.sessionId ? ` · session #${esc(w.sessionId.slice(-6))}` : ""}</div>
        <div class="lp-bubble-body"><span class="lp-bubble-who">🚨 pipeline integrity</span> ${esc(w.message)}</div>
      `;
      frag.appendChild(warn);
    }
    for (const ev of convo) {
      const bubble = renderDialogueBubble(ev);
      if (bubble) frag.appendChild(bubble);
    }
    rowsEl.appendChild(frag);
    // Auto-scroll to latest (bottom, since chronological)
    rowsEl.scrollTop = rowsEl.scrollHeight;
  }

  function renderDialogueBubble(ev) {
    const node = document.createElement("div");
    node.className = "lp-bubble";
    const ts = ev.at ? formatTime(ev.at) : "";

    if (ev.type === "session.start") {
      node.className = "lp-bubble lp-bubble-system";
      node.innerHTML = `<div class="lp-bubble-ts">${esc(ts)}</div><div class="lp-bubble-body">🎬 세션 시작 — <code>${esc(ev.session_id ?? "")}</code></div>`;
      return node;
    }
    if (ev.type === "session.end") {
      node.className = "lp-bubble lp-bubble-system";
      node.innerHTML = `<div class="lp-bubble-ts">${esc(ts)}</div><div class="lp-bubble-body">🎬 세션 종료 · ${esc(ev.outcome ?? "done")}</div>`;
      return node;
    }
    if (ev.type === "pipeline.stage") {
      node.className = "lp-bubble lp-bubble-stage";
      const line = stageLine(ev.stage);
      node.innerHTML = `
        <div class="lp-bubble-ts">${esc(ts)}</div>
        <div class="lp-bubble-stage-head">▶ ${esc(String(ev.stage ?? "").toUpperCase())}</div>
        <div class="lp-bubble-body"><span class="lp-bubble-who">🎩 팀장</span> "${esc(line)}"</div>
      `;
      return node;
    }
    if (ev.type === "agent.dispatched") {
      const emoji = agentEmoji("buildcrew");
      const line = dispatchLine(ev.agent, ev.prompt);
      node.className = "lp-bubble lp-bubble-from-lead";
      node.innerHTML = `
        <div class="lp-bubble-ts">${esc(ts)}</div>
        <div class="lp-bubble-body">
          <span class="lp-bubble-who">${emoji} 팀장 → ${esc(agentEmoji(ev.agent))} ${esc(ev.agent)}</span>
          "${esc(line)}"
        </div>
      `;
      // Clicking the bubble opens agent detail panel
      node.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("dashboard:agent-select", { detail: { agent: ev.agent } }));
      });
      return node;
    }
    if (ev.type === "agent.completed") {
      const emoji = agentEmoji(ev.agent);
      const line = completeLine(ev.agent, ev.output_summary);
      node.className = "lp-bubble lp-bubble-from-agent";
      node.innerHTML = `
        <div class="lp-bubble-ts">${esc(ts)}</div>
        <div class="lp-bubble-body">
          <span class="lp-bubble-who">${emoji} ${esc(ev.agent)} → 🎩 팀장</span>
          "${esc(line)}"
          ${ev.duration_s != null ? `<span class="lp-bubble-dur">(${ev.duration_s}s)</span>` : ""}
        </div>
      `;
      node.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("dashboard:agent-select", { detail: { agent: ev.agent } }));
      });
      return node;
    }
    if (ev.type === "issue.found") {
      const emoji = agentEmoji(ev.agent);
      const line = issueLine(ev.agent, ev.severity, ev.title ?? "");
      node.className = `lp-bubble lp-bubble-issue lp-bubble-issue-${ev.severity ?? "med"}`;
      node.innerHTML = `
        <div class="lp-bubble-ts">${esc(ts)}</div>
        <div class="lp-bubble-body">
          <span class="lp-bubble-who">${emoji} ${esc(ev.agent)}</span>
          "${esc(line)}"
        </div>
      `;
      node.addEventListener("click", () => {
        const ordered = [...state.events].reverse();
        openIssueModal(ev, ordered);
      });
      return node;
    }
    return null;
  }

  function passesFilter(ev) {
    if (state.sessionFilter && ev.session_id !== state.sessionFilter) return false;
    if (state.agentFilter && ev.agent !== state.agentFilter) return false;
    if (state.typeFilter === "agent" && !ev.type.startsWith("agent.")) return false;
    if (state.typeFilter === "file" && ev.type !== "file.written") return false;
    if (state.typeFilter === "issue" && ev.type !== "issue.found") return false;
    return true;
  }

  function renderRow(ev) {
    const row = document.createElement("div");
    row.className = "lp-row";
    row.dataset.type = ev.type;
    if (ev.type === "issue.found") {
      row.style.background = SEVERITY_BG[ev.severity] ?? "";
    }
    // Session-color left border (3px) so multi-session streams are visually distinct
    if (ev.session_id) {
      row.style.borderLeft = `3px solid ${session.sessionColor(ev.session_id)}`;
      row.style.paddingLeft = "11px";
    }

    const ts = ev.at ? formatTime(ev.at) : "";
    const typeColor = TYPE_COLORS[ev.type] ?? "#c9a876";
    const summary = summarize(ev);
    const shortSid = ev.session_id ? ev.session_id.slice(-6) : "";

    row.innerHTML = `
      <div class="lp-row-top">
        <span class="lp-ts">${escape(ts)}</span>
        <span class="lp-type" style="color:${typeColor}">${escape(ev.type)}</span>
        ${ev.agent ? `<span class="lp-agent">${escape(ev.agent)}</span>` : ""}
        ${shortSid ? `<span class="lp-sid" style="color:${session.sessionColor(ev.session_id)}" title="session ${escape(ev.session_id)}">#${escape(shortSid)}</span>` : ""}
      </div>
      <div class="lp-row-body">${summary}</div>
    `;
    // Row click → smart action per type
    row.addEventListener("click", (e) => {
      // If clicking inside an open detail, don't collapse
      if (e.target.closest(".lp-row-detail")) return;

      if (ev.type === "issue.found") {
        // Use oldest-first order for surrounding context
        const ordered = [...state.events].reverse();
        openIssueModal(ev, ordered);
        return;
      }
      if (ev.type === "file.written" && ev.path) {
        copyToClipboard(ev.path)
          .then(() => toast(`copied: ${ev.path.split("/").pop()}`))
          .catch(() => toast("copy failed"));
        return;
      }
      // Default: toggle raw JSON for inspection
      const existing = row.querySelector(".lp-row-detail");
      if (existing) { existing.remove(); return; }
      const detail = document.createElement("pre");
      detail.className = "lp-row-detail";
      detail.textContent = JSON.stringify(ev, null, 2);
      row.appendChild(detail);
    });
    return row;
  }

  // expose events for modals that need context
  function allEvents() { return state.events; }
  window._dashboardAllEvents = allEvents;

  function renderTerminal() {
    metaEl.textContent = `⌨ ${state.terminal.length} lines · raw claude -p stream`;
    rowsEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const line of state.terminal) frag.appendChild(renderTerminalLine(line));
    rowsEl.appendChild(frag);
    rowsEl.scrollTop = rowsEl.scrollHeight;
  }

  function renderTerminalLine(line) {
    const el = document.createElement("div");
    el.className = `lp-term-line lp-term-${line.kind}`;
    if (line.kind === "meta") {
      el.textContent = line.text;
    } else if (line.kind === "err") {
      el.textContent = line.text;
    } else if (line.kind === "out") {
      el.textContent = renderStreamPayload(line.payload);
    }
    return el;
  }

  function renderStreamPayload(p) {
    if (!p) return "";
    if (p.raw) return p.raw;
    // Claude -p stream-json common shapes
    if (p.type === "system") {
      const sub = p.subtype ? `[${p.subtype}]` : "";
      return `system ${sub}`.trim();
    }
    if (p.type === "assistant" && p.message?.content) {
      return p.message.content.map((c) => {
        if (c.type === "text") return c.text;
        if (c.type === "tool_use") return `◆ ${c.name}(${JSON.stringify(c.input).slice(0, 100)})`;
        return JSON.stringify(c).slice(0, 200);
      }).join("\n");
    }
    if (p.type === "user" && p.message?.content) {
      return p.message.content.map((c) => {
        if (c.type === "tool_result") return `→ ${JSON.stringify(c.content).slice(0, 200)}`;
        return JSON.stringify(c).slice(0, 200);
      }).join("\n");
    }
    if (p.type === "result") {
      return `result: ${p.subtype ?? ""} ${p.result ?? ""}`.trim();
    }
    return JSON.stringify(p).slice(0, 300);
  }

  function pushTerminal(line) {
    state.terminal.push(line);
    if (state.terminal.length > 2000) state.terminal.splice(0, state.terminal.length - 2000);
    if (state.mode === "terminal" && !isPaused()) renderTerminal();
  }

  function summarize(ev) {
    switch (ev.type) {
      case "session.start":
        return `<span class="lp-muted">session started</span> <code>${escape(ev.session_id ?? "")}</code>`;
      case "session.end":
        return `<span class="lp-muted">session ended</span> <code>${escape(ev.outcome ?? "")}</code>`;
      case "pipeline.stage":
        return `<span class="lp-stage">▶ STAGE: ${escape(ev.stage ?? "")}</span>`;
      case "agent.dispatched": {
        const p = ev.prompt ? escape(ev.prompt) : "<span class='lp-muted'>no prompt</span>";
        return `<span class="lp-muted">dispatched:</span> ${p}`;
      }
      case "agent.completed": {
        const dur = ev.duration_s != null ? `${ev.duration_s}s` : "";
        const s = ev.output_summary ? escape(ev.output_summary) : "<span class='lp-muted'>—</span>";
        return `<span class="lp-muted">done</span> ${dur ? `<span class="lp-muted">(${dur})</span>` : ""} ${s}`;
      }
      case "file.written":
        return `<code>${escape(ev.path ?? "")}</code>${ev.summary ? ` <span class='lp-muted'>${escape(ev.summary)}</span>` : ""}`;
      case "issue.found":
        return `<span class="lp-sev lp-sev-${escape(ev.severity ?? "")}">⚠ ${escape((ev.severity ?? "").toUpperCase())}</span> ${escape(ev.title ?? "")}`;
      default:
        return `<code>${escape(JSON.stringify(ev))}</code>`;
    }
  }

  // -------- public API --------

  function push(ev) {
    state.events.unshift(ev);
    if (state.events.length > MAX_ROWS) state.events.length = MAX_ROWS;
    if (ev.agent && !state.agents.has(ev.agent)) {
      state.agents.add(ev.agent);
      const opt = document.createElement("option");
      opt.value = ev.agent;
      opt.textContent = ev.agent;
      agentFilterEl.appendChild(opt);
    }
    if (ev.session_id && !state.sessionIds.has(ev.session_id)) {
      state.sessionIds.add(ev.session_id);
      addSessionChip(ev.session_id);
      // Notify statusbar badge
      window.dispatchEvent(new CustomEvent("dashboard:sessions-changed"));
    }
    // Skip DOM render while paused — event is still recorded in state.events,
    // so export captures it correctly.
    if (!isPaused()) render();
  }

  // When resume is pressed, re-render to catch up on queued events
  window.addEventListener("dashboard:resumed", () => render());

  // -------- filters --------

  agentFilterEl.addEventListener("change", (e) => {
    state.agentFilter = e.target.value;
    render();
  });
  typeFilterEl.addEventListener("change", (e) => {
    state.typeFilter = e.target.value;
    render();
  });
  clearBtn.addEventListener("click", () => {
    state.agentFilter = "";
    state.typeFilter = "";
    state.sessionFilter = "";
    agentFilterEl.value = "";
    typeFilterEl.value = "";
    selectSessionChip("");
    render();
  });

  // Session chip behavior (delegated click on the tab row)
  sessionTabsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".lp-session-chip");
    if (!chip) return;
    selectSessionChip(chip.dataset.session ?? "");
  });

  // External trigger: statusbar badge can filter to a specific session
  window.addEventListener("dashboard:select-session", (e) => {
    const sid = e.detail?.sessionId ?? "";
    selectSessionChip(sid);
  });

  function selectSessionChip(sid) {
    state.sessionFilter = sid;
    for (const chip of sessionTabsEl.querySelectorAll(".lp-session-chip")) {
      chip.classList.toggle("active", (chip.dataset.session ?? "") === sid);
    }
    render();
  }

  function addSessionChip(sessionId) {
    const chip = document.createElement("button");
    chip.className = "lp-session-chip";
    chip.dataset.session = sessionId;
    const short = sessionId.slice(-6);
    const color = session.sessionColor(sessionId);
    chip.innerHTML = `<span class="lp-chip-dot" style="background:${color}"></span>#${short}`;
    chip.title = `session ${sessionId}`;
    sessionTabsEl.appendChild(chip);
  }

  // Tab switcher
  for (const tabBtn of container.querySelectorAll(".lp-tab")) {
    tabBtn.addEventListener("click", () => {
      state.mode = tabBtn.dataset.mode;
      document.body.dataset.tab = state.mode;
      for (const b of container.querySelectorAll(".lp-tab")) {
        b.classList.toggle("active", b === tabBtn);
      }
      render();
      if (state.mode === "terminal") {
        // Autofocus the input when switching to Terminal tab
        const input = document.getElementById("cmd-input");
        if (input && !input.disabled) input.focus();
      }
    });
  }

  // Fetch project info once and populate the project picker
  fetch("/project")
    .then((r) => (r.ok ? r.json() : null))
    .then((info) => {
      if (!info) return;
      const pathEl = document.getElementById("lp-project-path");
      if (pathEl) {
        pathEl.textContent = info.name ?? info.path ?? "(unknown)";
        pathEl.title = info.path ?? "";
      }
    })
    .catch(() => {});

  // (session count now shown by the session-chip row + statusbar badge)

  // Listen for agent-select from canvas (click a character → filter log + open side panel)
  window.addEventListener("dashboard:agent-select", (e) => {
    const agent = e.detail?.agent;
    if (!agent) return;
    state.agentFilter = agent;
    agentFilterEl.value = agent;
    render();
    openAgentPanel(agent, state.events, session.state);
  });

  render();

  return { push, pushTerminal };
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Fallback for older browsers
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch {}
  ta.remove();
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n) { return String(n).padStart(2, "0"); }
function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
