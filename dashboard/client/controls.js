/**
 * Status-bar controls: pause/resume stream + export session to JSONL.
 *
 * Pause: queues incoming events until resumed. Scenes and metrics still
 *        get events as they arrive (state stays consistent) but the
 *        log panel + animations can be frozen by the pause flag.
 *        Simplest behavior: when paused, the SSE still feeds state/store,
 *        but new events are NOT pushed to the log panel until resumed.
 */

import { session } from "./state/session.js";
import { toast } from "./modals.js";

const state = {
  paused: false,
  queue: [],
  logPanel: null,
};

export function mountControls({ logPanel }) {
  state.logPanel = logPanel;
  const pauseBtn = document.getElementById("btn-pause");
  const exportBtn = document.getElementById("btn-export");

  pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    pauseBtn.classList.toggle("active", state.paused);
    pauseBtn.textContent = state.paused ? "▶ resume" : "⏸ pause";
    if (!state.paused) {
      // Flush queue into log panel
      for (const ev of state.queue) state.logPanel?.push(ev);
      state.queue = [];
      toast("resumed");
    } else {
      toast("paused · events still recorded");
    }
  });

  exportBtn.addEventListener("click", () => {
    exportSession();
  });
}

export function interceptForPause(ev, logPanel) {
  // Called by dispatcher. Returns true if event was queued (caller should skip log push).
  if (state.paused) {
    state.queue.push(ev);
    return true;
  }
  return false;
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
  // Prefer the panel's ordered list; fall back to session derived data.
  const panelEvents = window._dashboardAllEvents?.() ?? [];
  if (panelEvents.length > 0) {
    // Panel is most-recent first; export in chronological order
    return [...panelEvents].reverse();
  }
  return [];
}
