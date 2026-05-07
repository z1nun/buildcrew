/**
 * lib/watch/render.js — terminal frame composition.
 *
 * Reads dashboard state (no mutation) and writes a single atomic ANSI frame
 * to stdout. Splitting render out of bin/watch.js means:
 *   - No filesystem or stdin access here — pure state → string
 *   - scheduleRender() is the only public throttle; callers in state.js
 *     trigger it via the onChange callback they were given
 *
 * The frame is built by capturing each render*() function's console.log
 * output into an in-memory buffer (via a temporary monkey-patch). That
 * buffer is then emitted in one process.stdout.write call — eliminates
 * the per-line flicker we'd see from 30+ separate writes.
 */

// ------------------------------------------------------------------
// ANSI palette
// ------------------------------------------------------------------
const NO_COLOR = !!process.env.NO_COLOR;
export const c = NO_COLOR
  ? new Proxy({}, { get: () => "" })
  : {
      reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
      black: "\x1b[30m", red: "\x1b[31m", green: "\x1b[32m",
      gold:  "\x1b[33m", blue: "\x1b[34m", mag: "\x1b[35m",
      cyan:  "\x1b[36m",
      // Primary secondary text — readable on dark terminals (was \x1b[90m which rendered too dim)
      gray: "\x1b[38;5;250m",
      // Muted — for truly tertiary metadata (timestamps, separators)
      muted: "\x1b[38;5;244m",
      bgWood: "\x1b[48;5;94m",
    };

// Anti-flicker rendering primitives.
// HOME moves cursor to top-left WITHOUT clearing — we overwrite in place and
// use CLR_EOL per line + CLR_BELOW at the end to erase leftovers. The old
// `\x1b[2J\x1b[H` caused a visible flash every frame (blank → redraw).
export const HOME = "\x1b[H";
export const CLR_EOL = "\x1b[K";      // clear from cursor to end of line
export const CLR_BELOW = "\x1b[J";    // clear from cursor to end of screen
export const ALT_SCREEN_ON = "\x1b[?1049h";
export const ALT_SCREEN_OFF = "\x1b[?1049l";
export const HIDE_CURSOR = "\x1b[?25l";
export const SHOW_CURSOR = "\x1b[?25h";

// ------------------------------------------------------------------
// Render scheduler — coalesces bursts to ~20fps
// ------------------------------------------------------------------
let renderPending = false;
let renderImpl = () => {};

export function setRenderer(fn) { renderImpl = fn; }

export function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setImmediate(() => { renderPending = false; renderImpl(); });
}

// ------------------------------------------------------------------
// Section helpers
// ------------------------------------------------------------------
function sectionTitle(label, width) {
  const line = `${c.bold}${c.cyan}${label}${c.reset}`;
  const rule = c.gray + "─".repeat(Math.max(0, width - stripAnsi(line).length - 3)) + c.reset;
  return `${line} ${rule}`;
}

function renderHeader(state) {
  const width = Math.max(60, process.stdout.columns ?? 80);
  const title = `${c.bold}🏠 buildcrew${c.reset}`;
  const conn = state.connected
    ? `${c.green}● live${c.reset}`
    : `${c.red}○ disconnected${c.reset}`;
  const project = process.cwd().split("/").pop();
  const sid = state.sessionId ? state.sessionId.slice(-8) : "—";
  // Line 1: title + project + session + conn
  const left = `${title}   ${c.gray}📁${c.reset} ${project}   ${c.gray}session${c.reset} ${c.cyan}${sid}${c.reset}`;
  const pad = Math.max(2, width - stripAnsi(left).length - stripAnsi(conn).length);
  console.log(left + " ".repeat(pad) + conn);

  // Line 2: stats bar (stage · elapsed · events · files · issues)
  const stage = state.currentStage
    ? `${c.gold}${c.bold}${state.currentStage}${c.reset}`
    : `${c.gray}idle${c.reset}`;
  const elapsedMs = state.sessionStartAt
    ? (state.sessionEndAt ?? Date.now()) - state.sessionStartAt : 0;
  const elapsed = formatDuration(Math.floor(elapsedMs / 1000));
  const crit = state.issues.critical, high = state.issues.high, med = state.issues.med;
  const issuesStr = (crit + high + med) === 0
    ? `${c.gray}no issues${c.reset}`
    : `${crit > 0 ? c.red + "🚨 " + crit + c.reset + " " : ""}${high > 0 ? c.gold + "⚠ " + high + c.reset + " " : ""}${med > 0 ? c.gold + "· " + med + c.reset : ""}`.trim();
  console.log(
    `  ${c.gray}stage${c.reset} ${stage}   ${c.gray}elapsed${c.reset} ${elapsed}   ` +
    `${c.gray}events${c.reset} ${state.events}   ${c.gray}files${c.reset} ${state.files}   ` +
    `${c.gray}issues${c.reset} ${issuesStr}`
  );
  console.log("");
}

function renderNow(state, AGENTS, width) {
  console.log(sectionTitle("NOW", width));
  if (state.activeAgents.size === 0) {
    const lastDone = [...state.completedAgents.entries()]
      .sort((a, b) => b[1].lastAt - a[1].lastAt).slice(0, 3);
    if (lastDone.length === 0) {
      console.log(`  ${c.gray}(idle — invoke any @agent to begin)${c.reset}`);
    } else {
      console.log(`  ${c.gray}idle · last active:${c.reset}`);
      for (const [id, info] of lastDone) {
        const emoji = (AGENTS.find(a => a.id === id)?.emoji) ?? "●";
        const dur = formatDuration(Math.floor(info.duration / 1000));
        console.log(`    ${c.green}✓${c.reset} ${emoji} ${id} ${c.gray}· ${dur}${c.reset}`);
      }
    }
  } else {
    const now = Date.now();
    for (const [id, info] of state.activeAgents) {
      const emoji = (AGENTS.find(a => a.id === id)?.emoji) ?? "●";
      const elapsed = formatDuration(Math.floor((now - info.startAt) / 1000));
      const prompt = truncate(info.prompt, Math.max(20, width - 28));
      console.log(`  ${c.gold}●${c.reset} ${emoji} ${c.bold}${id}${c.reset} ${c.muted}${elapsed} ·${c.reset} ${prompt}`);
    }
  }
  console.log("");
}

function renderPipeline(state, STAGES, width) {
  console.log(sectionTitle("PIPELINE", width));
  const parts = STAGES.map((name) => {
    if (state.currentStage === name)
      return `${c.gold}${c.bold}●${c.reset} ${c.gold}${name}${c.reset}`;
    if (state.completedStages.has(name))
      return `${c.green}✓${c.reset} ${c.green}${name}${c.reset}`;
    return `${c.gray}○ ${name}${c.reset}`;
  });
  console.log("  " + parts.join(c.gray + "  →  " + c.reset));
  console.log("");
}

function renderAgents(state, AGENTS, width) {
  console.log(sectionTitle("ROSTER", width));
  const nCols = width >= 120 ? 4 : width >= 80 ? 3 : 2;
  const cellW = Math.floor((width - 4) / nCols) - 1;
  const byRoom = new Map();
  for (const a of AGENTS) {
    if (!byRoom.has(a.room)) byRoom.set(a.room, []);
    byRoom.get(a.room).push(a);
  }
  for (const [room, list] of byRoom) {
    const activeCount = list.filter(a => state.activeAgents.has(a.id)).length;
    const badge = activeCount > 0 ? `${c.gold}${activeCount} active${c.reset}` : `${c.gray}—${c.reset}`;
    console.log(`  ${c.bold}${room}${c.reset}  ${c.gray}${list.length} agents${c.reset}  ${badge}`);
    const rows = Math.ceil(list.length / nCols);
    for (let r = 0; r < rows; r++) {
      const cells = [];
      for (let col = 0; col < nCols; col++) {
        const a = list[r + col * rows];
        if (!a) { cells.push(""); continue; }
        const isActive = state.activeAgents.has(a.id);
        const didRun = state.completedAgents.has(a.id);
        const mark = isActive ? `${c.gold}●${c.reset}` : didRun ? `${c.green}✓${c.reset}` : `${c.gray}○${c.reset}`;
        const name = isActive ? `${c.bold}${a.id}${c.reset}` : didRun ? a.id : `${c.gray}${a.id}${c.reset}`;
        const cell = `    ${mark} ${a.emoji} ${name}`;
        cells.push(padEnd(cell, cellW));
      }
      console.log(cells.join(" "));
    }
  }
  console.log("");
}

function renderFiles(state, width) {
  if (state.recentFiles.length === 0) return;
  console.log(sectionTitle("FILES", width));
  for (const f of state.recentFiles.slice(-5)) {
    const rel = f.path.split("/").slice(-3).join("/");
    const by = f.agent ? ` ${c.gray}by ${f.agent}${c.reset}` : "";
    console.log(`  ${c.blue}📝${c.reset} ${rel} ${c.gray}(${f.tool ?? "edit"})${c.reset}${by}`);
  }
  console.log("");
}

function renderIssues(state, width) {
  if (state.recentIssues.length === 0) return;
  console.log(sectionTitle("ISSUES", width));
  for (const iss of state.recentIssues.slice(-3)) {
    const sev = iss.severity ?? "low";
    const color = sev === "critical" ? c.red : sev === "high" ? c.gold : c.gold;
    console.log(`  ${color}⚠${c.reset} ${color}${sev}${c.reset} ${c.gray}·${c.reset} ${truncate(iss.title, width - 16)}`);
  }
  console.log("");
}

function renderCoherence(state, width) {
  if (!state.coherence) return;
  const co = state.coherence;
  console.log(sectionTitle("COHERENCE", width));
  // Score color: 90+ green, 70-89 cyan, 50-69 gold, <50 red
  let scoreColor = c.gray, statusEmoji = "○";
  if (co.score == null) {
    scoreColor = c.gray;
    statusEmoji = "?";
  } else if (co.score >= 90) {
    scoreColor = c.green; statusEmoji = "✓";
  } else if (co.score >= 70) {
    scoreColor = c.cyan; statusEmoji = "●";
  } else if (co.score >= 50) {
    scoreColor = c.gold; statusEmoji = "⚠";
  } else {
    scoreColor = c.red; statusEmoji = "✗";
  }
  const scoreStr = co.score == null ? `${c.gray}—${c.reset}` : `${scoreColor}${c.bold}${co.score}%${c.reset}`;
  const statusStr = co.status ? `${scoreColor}${co.status}${c.reset}` : `${c.gray}—${c.reset}`;
  const edgesStr = (co.edgesActual != null && co.edgesPossible != null)
    ? `${c.gray}(${co.edgesActual}/${co.edgesPossible} edges)${c.reset}`
    : "";
  const fabBadge = co.fabrications > 0
    ? `  ${c.red}🚨 ${co.fabrications} fabrication${co.fabrications > 1 ? "s" : ""}${c.reset}`
    : "";
  const gapBadge = co.gaps > 0
    ? `  ${c.gold}⚠ ${co.gaps} gap${co.gaps > 1 ? "s" : ""}${c.reset}`
    : `  ${c.gray}no gaps${c.reset}`;
  console.log(`  ${statusEmoji} ${scoreStr} ${statusStr} ${edgesStr}${gapBadge}${fabBadge}`);
  console.log(`  ${c.gray}feature ${c.cyan}${co.feature}${c.reset}  ${c.gray}· press ${c.bold}r${c.reset}${c.gray} for full report${c.reset}`);
  console.log("");
}

function renderRecent(state, width) {
  console.log(sectionTitle("LOG", width));
  if (state.recent.length === 0) {
    console.log(`  ${c.gray}(no events yet)${c.reset}`);
  } else {
    for (const ev of state.recent.slice(-6)) {
      console.log("  " + formatEvent(ev, width - 4));
    }
  }
}

function formatEvent(ev, maxLen) {
  const t = new Date(ev.at || Date.now());
  const hh = String(t.getHours()).padStart(2, "0");
  const mm = String(t.getMinutes()).padStart(2, "0");
  const ss = String(t.getSeconds()).padStart(2, "0");
  const ts = `${c.gray}${hh}:${mm}:${ss}${c.reset}`;
  let body;
  switch (ev.type) {
    case "agent.dispatched":
      body = `${c.gold}▶${c.reset} ${c.bold}${ev.agent ?? "?"}${c.reset} ${c.muted}·${c.reset} ${truncate(ev.prompt, 60)}`;
      break;
    case "agent.completed":
      body = `${c.green}✓${c.reset} ${ev.agent ?? "*"} ${c.gray}done${c.reset}`;
      break;
    case "file.written":
      body = `${c.blue}📝${c.reset} ${truncate(ev.path?.split("/").slice(-2).join("/") ?? "?", maxLen - 20)}`;
      break;
    case "issue.found":
      body = `${c.red}⚠${c.reset} ${ev.severity ?? ""} ${ev.title ?? ""}`;
      break;
    case "session.start":
      body = `${c.mag}◆${c.reset} session started`;
      break;
    case "session.end":
      body = `${c.mag}◼${c.reset} session ended`;
      break;
    case "pipeline.stage":
      body = `${c.cyan}→${c.reset} stage: ${ev.stage}`;
      break;
    default:
      body = `${c.gray}${ev.type}${c.reset}`;
  }
  return `${ts}  ${body}`;
}

/**
 * Compose and emit a single atomic frame. Reads from `state` only.
 *
 * AGENTS/STAGES are passed in (rather than imported) so render.js stays
 * decoupled from the agent roster — the test suite can pass a synthetic
 * roster without monkey-patching imports.
 */
export function render(state, { AGENTS, STAGES }) {
  const width = Math.max(60, process.stdout.columns ?? 80);

  // Capture every render*() call's output into an in-memory buffer by
  // monkey-patching console.log for the duration of the render. This lets us
  // emit the whole frame in a single process.stdout.write — eliminating the
  // per-line flicker that came from 30+ separate writes.
  const lines = [];
  const origLog = console.log;
  console.log = (...args) => {
    lines.push(args.length === 0 ? "" : args.map(String).join(" "));
  };
  try {
    renderHeader(state);
    renderNow(state, AGENTS, width);
    renderPipeline(state, STAGES, width);
    renderAgents(state, AGENTS, width);
    renderFiles(state, width);
    renderIssues(state, width);
    renderCoherence(state, width);
    renderRecent(state, width);
  } finally {
    console.log = origLog;
  }
  lines.push("");
  lines.push(`${c.gray}q quit  ·  r show full coherence report${c.reset}`);

  // Single atomic frame: cursor home → each line + clear-to-EOL (erases any
  // leftover chars from a previous longer line) → clear-below (handles frame
  // shrinkage). No `\x1b[2J` flash.
  const frame = HOME + lines.map(l => l + CLR_EOL).join("\n") + "\n" + CLR_BELOW;
  process.stdout.write(frame);
}

// ------------------------------------------------------------------
// tiny utils — exported for state.js callers that build display strings
// ------------------------------------------------------------------
export function truncate(s, n) {
  if (!s) return "";
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
export function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
export function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ""); }
export function padEnd(s, n) {
  const visible = stripAnsi(s);
  const padLen = Math.max(0, n - visible.length);
  return s + " ".repeat(padLen);
}
