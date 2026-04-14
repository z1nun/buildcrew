/**
 * Event dispatcher.
 * Feeds session state, forwards scene animations, and pushes to log panel.
 */

import { session } from "../state/session.js";
import { interceptForPause } from "../controls.js";

export function attachDispatcher({ town, board, ui, logPanel }) {
  const es = new EventSource("/events");

  es.onopen = () => {
    ui.conn.textContent = "live";
    ui.conn.className = "live";
  };
  es.onerror = () => {
    ui.conn.textContent = "disconnected · retrying…";
    ui.conn.className = "dead";
  };
  es.onmessage = (msg) => {
    let ev;
    try { ev = JSON.parse(msg.data); }
    catch { return console.warn("[dispatcher] bad event", msg.data); }

    // State always updates (so export works consistently even when paused)
    session.handleEvent(ev);
    ui.count.textContent = `${session.state.eventCount} events`;

    // Log panel may be paused via controls
    const queued = interceptForPause(ev, logPanel);
    if (!queued) logPanel?.push(ev);

    handleAnimation(ev, town, board);
  };
}

function handleAnimation(ev, town, board) {
  switch (ev.type) {
    case "session.start":
      board.stage("SESSION START");
      return;
    case "session.end":
      board.stage(`SESSION END · ${ev.outcome ?? "done"}`);
      return;
    case "pipeline.stage":
      if (ev.stage) board.stage(ev.stage);
      return;
    case "agent.dispatched":
      if (ev.agent) town.wake(ev.agent, truncate(ev.prompt));
      return;
    case "agent.completed":
      if (ev.agent) town.idle(ev.agent, truncate(ev.output_summary));
      return;
    case "file.written":
      if (ev.agent && ev.path) town.fileWritten(ev.agent, ev.path);
      return;
    case "issue.found":
      if (ev.severity && ev.title) board.issue(ev.severity, ev.title);
      return;
  }
}

function truncate(s, n = 40) {
  if (!s) return "";
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
