/**
 * Overlay modals and toasts.
 * Single DOM container shared by issue-detail modal, agent-detail side panel,
 * and ephemeral toasts (file copied, pause indicator, etc).
 */

let root;
let modalEl;
let toastEl;

export function mountModals() {
  root = document.createElement("div");
  root.id = "overlay-root";
  root.innerHTML = `
    <style>
      #overlay-root { position: fixed; inset: 0; pointer-events: none; z-index: 100; }
      #overlay-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,0.5);
        pointer-events: auto;
        display: none;
      }
      #overlay-backdrop.show { display: block; }
      #overlay-modal {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: min(560px, 90vw);
        max-height: 80vh;
        background: #332a24;
        border: 2px solid #8b6f47;
        border-radius: 8px;
        padding: 18px 22px;
        color: #f5ebd7;
        font-family: ui-monospace, monospace;
        overflow-y: auto;
        pointer-events: auto;
        display: none;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
      }
      #overlay-modal.show { display: block; }
      #overlay-modal h2 {
        margin: 0 0 10px;
        font-size: 14px;
        letter-spacing: 2px;
        color: #b8a88c;
      }
      #overlay-modal .close {
        position: absolute;
        top: 10px; right: 14px;
        background: none; border: 0;
        color: #c9a876; cursor: pointer;
        font-size: 18px; line-height: 1;
        font-family: inherit;
      }
      #overlay-sidepanel {
        position: absolute;
        top: 0; right: 0; bottom: 32px;
        width: 380px;
        background: #332a24;
        border-left: 3px solid #8b6f47;
        color: #f5ebd7;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        transform: translateX(100%);
        transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1);
        pointer-events: auto;
        overflow-y: auto;
        box-shadow: -6px 0 20px rgba(0,0,0,0.5);
      }
      #overlay-sidepanel.show { transform: translateX(0); }
      #overlay-sidepanel .sp-header {
        padding: 14px 18px;
        background: #5c4a30;
        border-bottom: 1px solid #8b6f47;
        display: flex; justify-content: space-between; align-items: center;
      }
      #overlay-sidepanel h3 {
        margin: 0; font-size: 14px; letter-spacing: 1px;
      }
      #overlay-sidepanel .sp-close {
        background: none; border: 1px solid #8b6f47;
        color: #c9a876; cursor: pointer;
        font-size: 13px; padding: 2px 8px; border-radius: 3px;
        font-family: inherit;
      }
      #overlay-sidepanel .sp-body { padding: 14px 18px; }
      #overlay-sidepanel .sp-section {
        margin-bottom: 14px;
      }
      #overlay-sidepanel .sp-label {
        color: #b8a88c; font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 2px; margin-bottom: 4px;
      }
      #overlay-sidepanel .sp-value {
        color: #f5ebd7; font-size: 13px;
        word-break: break-word;
      }
      #overlay-sidepanel .sp-stat-row {
        display: flex; gap: 14px;
      }
      #overlay-sidepanel .sp-stat {
        flex: 1;
        background: #2a2420;
        border: 1px solid #5c4a30;
        padding: 8px 10px;
        border-radius: 4px;
      }
      #overlay-sidepanel .sp-stat .num { font-size: 18px; font-weight: bold; color: #ffd966; }
      #overlay-sidepanel .sp-recent {
        max-height: 320px;
        overflow-y: auto;
        background: #2a2420;
        border: 1px solid #5c4a30;
        border-radius: 4px;
      }
      #overlay-sidepanel .sp-recent-row {
        padding: 6px 10px;
        border-bottom: 1px solid #3c342c;
        font-size: 11px;
      }
      #overlay-sidepanel .sp-recent-row:last-child { border-bottom: 0; }
      #overlay-sidepanel .sp-recent-ts { color: #8a93a7; font-size: 10px; }
      #overlay-sidepanel .sp-recent-type { color: #c9a876; font-size: 10px; font-weight: bold; }
      #overlay-sidepanel .sp-recent-body { color: #f5ebd7; margin-top: 2px; word-break: break-word; }
      #overlay-sidepanel code {
        background: rgba(0,0,0,0.3);
        padding: 1px 4px;
        border-radius: 3px;
        color: #c9a876;
      }

      #toast-stack {
        position: absolute;
        bottom: 46px; right: 16px;
        display: flex; flex-direction: column; gap: 6px;
        pointer-events: none;
      }
      .toast {
        background: #5c4a30;
        color: #f5ebd7;
        border: 1px solid #c9a876;
        padding: 8px 14px;
        border-radius: 4px;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        animation: toast-in 180ms ease-out;
      }
      @keyframes toast-in {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
    <div id="overlay-backdrop"></div>
    <div id="overlay-modal">
      <button class="close" aria-label="close">✕</button>
      <div id="overlay-modal-content"></div>
    </div>
    <div id="overlay-sidepanel">
      <div class="sp-header">
        <h3 id="sp-title">agent</h3>
        <button class="sp-close">close</button>
      </div>
      <div class="sp-body" id="sp-body"></div>
    </div>
    <div id="toast-stack"></div>
  `;
  document.body.appendChild(root);

  modalEl = document.getElementById("overlay-modal");
  const backdrop = document.getElementById("overlay-backdrop");
  toastEl = document.getElementById("toast-stack");
  const sidepanel = document.getElementById("overlay-sidepanel");

  modalEl.querySelector(".close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", () => {
    closeModal();
    closeSidePanel();
  });
  sidepanel.querySelector(".sp-close").addEventListener("click", closeSidePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      closeSidePanel();
    }
  });
}

// -------- Issue detail modal --------

/**
 * @param {any} issueEvent
 * @param {any[]} surroundingEvents  events list with this issue inside it (oldest at end)
 */
export function openIssueModal(issueEvent, surroundingEvents) {
  const content = document.getElementById("overlay-modal-content");
  const backdrop = document.getElementById("overlay-backdrop");
  const sev = issueEvent.severity ?? "med";
  const sevColor = {
    critical: "#ff8566", high: "#f2b24a", med: "#f2b24a", low: "#c9a876",
  }[sev] ?? "#c9a876";

  // Find index of this issue in events; grab 3 before + 3 after for context
  const idx = surroundingEvents.findIndex((e) => e === issueEvent);
  const ctx = idx >= 0
    ? surroundingEvents.slice(Math.max(0, idx - 3), Math.min(surroundingEvents.length, idx + 4))
    : [issueEvent];

  const ctxRows = ctx.map((ev) => {
    const isMe = ev === issueEvent;
    return `
      <div style="padding: 6px 10px; border-left: 3px solid ${isMe ? sevColor : "#5c4a30"}; margin-bottom: 4px; background: ${isMe ? "rgba(255,133,102,0.08)" : "transparent"};">
        <div style="font-size: 10px; color: #8a93a7;">${escape(fmtTs(ev.at))} · <b style="color: #c9a876">${escape(ev.type)}</b>${ev.agent ? ` · ${escape(ev.agent)}` : ""}</div>
        <div style="font-size: 11px; margin-top: 2px;">${summarize(ev)}</div>
      </div>
    `;
  }).join("");

  content.innerHTML = `
    <h2 style="color: ${sevColor}">⚠ ${escape(sev.toUpperCase())} ISSUE</h2>
    <div style="font-size: 16px; line-height: 1.4; margin-bottom: 14px;">${escape(issueEvent.title ?? "")}</div>
    <div style="font-size: 11px; color: #b8a88c; margin-bottom: 16px;">
      reported by <b style="color: #c9a876">${escape(issueEvent.agent ?? "unknown")}</b> at ${escape(fmtTs(issueEvent.at))}
    </div>
    ${issueEvent.detail ? `<div style="background: #2a2420; padding: 10px 12px; border-radius: 4px; margin-bottom: 16px; font-size: 12px;">${escape(issueEvent.detail)}</div>` : ""}
    <div style="color: #b8a88c; font-size: 10px; letter-spacing: 2px; margin-bottom: 8px;">CONTEXT</div>
    ${ctxRows}
  `;
  modalEl.classList.add("show");
  backdrop.classList.add("show");
}

function closeModal() {
  modalEl.classList.remove("show");
  document.getElementById("overlay-backdrop").classList.remove("show");
}

// -------- Agent detail side panel --------

/**
 * @param {string} agentId
 * @param {any[]} allEvents  most-recent first (matches log panel order)
 * @param {any} sessionState
 */
export function openAgentPanel(agentId, allEvents, sessionState) {
  const sp = document.getElementById("overlay-sidepanel");
  const body = document.getElementById("sp-body");
  document.getElementById("sp-title").textContent = agentId;

  const mine = allEvents.filter((e) => e.agent === agentId);
  const recent = mine.slice(0, 20);

  const segs = sessionState.agentSegments.get(agentId) ?? [];
  const isActive = sessionState.agentActive.has(agentId);
  const activeStart = sessionState.agentActive.get(agentId);

  const totalMs = segs.reduce((sum, s) => sum + (s.end - s.start), 0)
    + (isActive ? (Date.now() - activeStart) : 0);

  const files = mine.filter((e) => e.type === "file.written").map((e) => e.path);
  const issues = mine.filter((e) => e.type === "issue.found");
  const latestDispatch = mine.find((e) => e.type === "agent.dispatched");

  body.innerHTML = `
    <div class="sp-section">
      <div class="sp-label">STATE</div>
      <div class="sp-value">${isActive ? "🟢 active" : "⚫ idle"}</div>
    </div>

    ${latestDispatch ? `
    <div class="sp-section">
      <div class="sp-label">LATEST PROMPT</div>
      <div class="sp-value">${escape(latestDispatch.prompt ?? "(no prompt)")}</div>
    </div>` : ""}

    <div class="sp-section sp-stat-row">
      <div class="sp-stat">
        <div class="sp-label">EVENTS</div>
        <div class="num">${mine.length}</div>
      </div>
      <div class="sp-stat">
        <div class="sp-label">FILES</div>
        <div class="num">${files.length}</div>
      </div>
      <div class="sp-stat">
        <div class="sp-label">ACTIVE</div>
        <div class="num">${fmtDuration(totalMs)}</div>
      </div>
    </div>

    ${issues.length > 0 ? `
    <div class="sp-section">
      <div class="sp-label">ISSUES REPORTED (${issues.length})</div>
      ${issues.slice(0, 5).map((i) => `
        <div style="padding: 5px 8px; background: #2a2420; border-left: 3px solid #ff8566; margin-bottom: 4px; border-radius: 3px; font-size: 11px;">
          <span style="color: #ff8566; font-weight: bold;">${escape((i.severity ?? "").toUpperCase())}</span>
          ${escape(i.title ?? "")}
        </div>`).join("")}
    </div>` : ""}

    ${files.length > 0 ? `
    <div class="sp-section">
      <div class="sp-label">FILES WRITTEN (${files.length})</div>
      <div style="max-height: 140px; overflow-y: auto; background: #2a2420; padding: 6px 8px; border-radius: 3px;">
        ${files.slice(0, 10).map((p) => `<div style="font-size: 11px; padding: 2px 0;"><code>${escape(p)}</code></div>`).join("")}
      </div>
    </div>` : ""}

    <div class="sp-section">
      <div class="sp-label">RECENT ACTIVITY</div>
      <div class="sp-recent">
        ${recent.length === 0 ? `<div style="padding: 10px; color: #8a93a7; font-size: 11px;">no events yet</div>` : recent.map((ev) => `
          <div class="sp-recent-row">
            <div><span class="sp-recent-ts">${escape(fmtTs(ev.at))}</span> <span class="sp-recent-type">${escape(ev.type)}</span></div>
            <div class="sp-recent-body">${summarize(ev)}</div>
          </div>`).join("")}
      </div>
    </div>
  `;

  sp.classList.add("show");
  document.getElementById("overlay-backdrop").classList.add("show");
}

function closeSidePanel() {
  const sp = document.getElementById("overlay-sidepanel");
  sp.classList.remove("show");
  if (!modalEl.classList.contains("show")) {
    document.getElementById("overlay-backdrop").classList.remove("show");
  }
}

// -------- Toast --------

export function toast(message, duration = 1800) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastEl.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 180ms ease-in";
  }, duration - 180);
  setTimeout(() => el.remove(), duration);
}

// -------- helpers --------

function fmtTs(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function pad(n) { return String(n).padStart(2, "0"); }
function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}
function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function summarize(ev) {
  switch (ev.type) {
    case "session.start":    return `session started <code>${escape(ev.session_id ?? "")}</code>`;
    case "session.end":      return `session ended · ${escape(ev.outcome ?? "")}`;
    case "pipeline.stage":   return `▶ ${escape(ev.stage ?? "")}`;
    case "agent.dispatched": return `dispatched: ${escape(ev.prompt ?? "")}`;
    case "agent.completed":  return `done: ${escape(ev.output_summary ?? "")}`;
    case "file.written":     return `<code>${escape(ev.path ?? "")}</code>`;
    case "issue.found":      return `⚠ ${escape((ev.severity ?? "").toUpperCase())} · ${escape(ev.title ?? "")}`;
    default:                 return `<code>${escape(JSON.stringify(ev))}</code>`;
  }
}
