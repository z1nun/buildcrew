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
    <div class="lp-header">
      <div class="lp-title">📋 EVENT LOG</div>
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
  `;

  const rowsEl = document.getElementById("lp-rows");
  const metaEl = document.getElementById("lp-meta");
  const agentFilterEl = document.getElementById("lp-agent-filter");
  const typeFilterEl = document.getElementById("lp-type-filter");
  const clearBtn = document.getElementById("lp-clear");

  const state = {
    events: [],       // most recent first
    agents: new Set(),
    agentFilter: "",
    typeFilter: "",
  };

  function render() {
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

  function passesFilter(ev) {
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

    const ts = ev.at ? formatTime(ev.at) : "";
    const typeColor = TYPE_COLORS[ev.type] ?? "#c9a876";
    const summary = summarize(ev);

    row.innerHTML = `
      <div class="lp-row-top">
        <span class="lp-ts">${escape(ts)}</span>
        <span class="lp-type" style="color:${typeColor}">${escape(ev.type)}</span>
        ${ev.agent ? `<span class="lp-agent">${escape(ev.agent)}</span>` : ""}
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
    agentFilterEl.value = "";
    typeFilterEl.value = "";
    render();
  });

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

  return { push };
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
