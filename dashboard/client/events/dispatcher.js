/**
 * Event dispatcher.
 * Reads SSE stream → translates DashboardEvent into scene actions.
 */

/**
 * @param {{ town: import("../scenes/TownScene.js").TownScene,
 *           board: import("../scenes/BillboardScene.js").BillboardScene,
 *           ui: { conn: HTMLElement, count: HTMLElement } }} refs
 */
export function attachDispatcher({ town, board, ui }) {
  const es = new EventSource("/events");
  let eventCount = 0;

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

    eventCount += 1;
    ui.count.textContent = `${eventCount} events`;
    handle(ev, town, board);
  };
}

/** @param {any} ev @param {any} town @param {any} board */
function handle(ev, town, board) {
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

    default:
      console.debug("[dispatcher] unknown event type:", ev.type);
  }
}

function truncate(s, n = 40) {
  if (!s) return "";
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
