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
};

export function mountControls({ logPanel }) {
  const pauseBtn = document.getElementById("btn-pause");
  const exportBtn = document.getElementById("btn-export");
  const logToggle = document.getElementById("btn-toggle-log");

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
