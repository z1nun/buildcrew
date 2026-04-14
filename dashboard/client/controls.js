/**
 * Status-bar controls: pause/resume render + export session JSONL.
 *
 * Pause model (fixed): every event is always recorded to state.events and
 * the session store. Pause only stops DOM re-renders and scene animations.
 * This keeps export/state consistent regardless of pause state.
 */

import { session } from "./state/session.js";
import { toast } from "./modals.js";

const state = {
  paused: false,
  sessionCycleIdx: -1, // -1 = all sessions, else index into activeSessions
};

export function mountControls({ logPanel }) {
  const pauseBtn = document.getElementById("btn-pause");
  const exportBtn = document.getElementById("btn-export");
  const logToggle = document.getElementById("btn-toggle-log");
  const sessionBadge = document.getElementById("sessions-badge");

  pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseBtn.classList.toggle("active", state.paused);
    pauseBtn.textContent = state.paused ? "▶ resume" : "⏸ pause";
    if (!state.paused) {
      window.dispatchEvent(new CustomEvent("dashboard:resumed"));
      toast("resumed");
    } else {
      toast("paused · events still recorded");
    }
  });

  exportBtn.addEventListener("click", () => {
    exportSession();
  });

  if (logToggle) {
    // On very small screens default to hidden; elsewhere default to visible
    if (window.matchMedia("(max-width: 700px)").matches) {
      document.body.classList.add("log-hidden");
    }
    const refresh = () => {
      const hidden = document.body.classList.contains("log-hidden");
      logToggle.classList.toggle("active", !hidden);
      logToggle.textContent = hidden ? "📋 log" : "✕ close";
      // Phaser needs a manual resize when the stage size changes
      window.dispatchEvent(new Event("resize"));
    };
    refresh();
    logToggle.addEventListener("click", () => {
      document.body.classList.toggle("log-hidden");
      refresh();
    });
  }

  if (sessionBadge) {
    const refreshBadge = () => {
      const sessions = session.allSessions();
      const activeCount = session.activeSessions().length;
      const total = sessions.length;
      const warnings = session.allWarnings();
      const warnSuffix = warnings.length > 0 ? ` ⚠ ${warnings.length}` : "";

      if (total === 0) {
        sessionBadge.innerHTML = `<span class="sb-dot" style="background:#5c4a30"></span> 0 sessions`;
      } else if (state.sessionCycleIdx === -1) {
        sessionBadge.innerHTML =
          `<span class="sb-dot" style="background:${activeCount > 0 ? "#a8d994" : "#5c4a30"}"></span> ` +
          `${activeCount}/${total} sessions${warnSuffix}`;
      } else {
        const s = sessions[state.sessionCycleIdx];
        const sw = session.sessionWarnings(s.id);
        sessionBadge.innerHTML =
          `<span class="sb-dot" style="background:${s.color}"></span> ` +
          `#${s.id.slice(-6)}${sw.length ? ` ⚠ ${sw.length}` : ""}`;
      }
      sessionBadge.style.borderColor = warnings.length > 0 ? "#ff8566" : "";
      sessionBadge.title = warnings.length > 0
        ? `⚠ ${warnings.length} pipeline integrity warning(s) — click to inspect`
        : "active sessions — click to filter";
    };
    refreshBadge();
    setInterval(refreshBadge, 2000); // keep active count fresh (idle timeout)
    window.addEventListener("dashboard:sessions-changed", refreshBadge);

    // Click cycles: all → first session → next → all
    sessionBadge.addEventListener("click", () => {
      const sessions = session.allSessions();
      if (sessions.length === 0) return;
      state.sessionCycleIdx += 1;
      if (state.sessionCycleIdx >= sessions.length) state.sessionCycleIdx = -1;
      const sid = state.sessionCycleIdx === -1 ? "" : sessions[state.sessionCycleIdx].id;
      window.dispatchEvent(new CustomEvent("dashboard:select-session", {
        detail: { sessionId: sid },
      }));
      refreshBadge();
    });
  }
}

export function isPaused() {
  return state.paused;
}

function exportSession() {
  const events = reconstructEvents();
  if (events.length === 0) {
    toast("nothing to export");
    return;
  }
  const content = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const blob = new Blob([content], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `buildcrew-session-${ts}.jsonl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`exported ${events.length} events`);
}

function reconstructEvents() {
  const panelEvents = window._dashboardAllEvents?.() ?? [];
  if (panelEvents.length > 0) {
    // Panel stores most-recent-first; export chronologically
    return [...panelEvents].reverse();
  }
  return [];
}
