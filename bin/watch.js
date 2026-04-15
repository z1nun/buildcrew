#!/usr/bin/env node
/**
 * buildcrew watch — terminal-native live monitor.
 *
 * Tails .claude/buildcrew/events.jsonl (written by the CC hook) and renders
 * a compact live status pane in the user's terminal. Zero runtime deps —
 * just ANSI + node:fs.
 *
 * Usage:  npx buildcrew watch
 *
 * Exit with q or Ctrl-C.
 */

import { createReadStream, watchFile, statSync, existsSync, mkdirSync, closeSync, openSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline, { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const EVENTS_PATH = process.env.BUILDCREW_EVENTS_PATH
  ?? join(process.cwd(), ".claude", "buildcrew", "events.jsonl");

// ------------------------------------------------------------------
// ANSI helpers
// ------------------------------------------------------------------
const NO_COLOR = !!process.env.NO_COLOR;
const c = NO_COLOR
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
const HOME = "\x1b[H";
const CLR_EOL = "\x1b[K";      // clear from cursor to end of line
const CLR_BELOW = "\x1b[J";    // clear from cursor to end of screen
const ALT_SCREEN_ON = "\x1b[?1049h";
const ALT_SCREEN_OFF = "\x1b[?1049l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";

// ------------------------------------------------------------------
// Agent roster (matches dashboard/client/scenes/TownScene.js)
// ------------------------------------------------------------------
const AGENTS = [
  { id: "buildcrew",        room: "Meeting",    emoji: "🎩" },
  { id: "planner",          room: "Meeting",    emoji: "📋" },
  { id: "designer",         room: "Meeting",    emoji: "🎨" },
  { id: "developer",        room: "Meeting",    emoji: "💻" },
  { id: "qa-tester",        room: "QA Lab",     emoji: "🧪" },
  { id: "browser-qa",       room: "QA Lab",     emoji: "🌐" },
  { id: "reviewer",         room: "QA Lab",     emoji: "🧐" },
  { id: "health-checker",   room: "QA Lab",     emoji: "🩺" },
  { id: "security-auditor", room: "SecOps",     emoji: "🛡" },
  { id: "canary-monitor",   room: "SecOps",     emoji: "🐤" },
  { id: "shipper",          room: "SecOps",     emoji: "🚢" },
  { id: "thinker",          room: "Think Tank", emoji: "🤔" },
  { id: "architect",        room: "Think Tank", emoji: "📐" },
  { id: "design-reviewer",  room: "Think Tank", emoji: "👀" },
  { id: "investigator",     room: "Field",      emoji: "🕵" },
  { id: "qa-auditor",       room: "Field",      emoji: "⚖" },
];

const STAGES = ["PLAN", "DESIGN", "DEV", "QA", "REVIEW", "SHIP"];
const AGENT_STAGE = {
  planner: "PLAN", thinker: "PLAN",
  designer: "DESIGN", "design-reviewer": "DESIGN", architect: "DESIGN",
  developer: "DEV",
  "qa-tester": "QA", "browser-qa": "QA", "health-checker": "QA",
  "qa-auditor": "QA", "security-auditor": "QA", investigator: "QA",
  "canary-monitor": "QA",
  reviewer: "REVIEW",
  shipper: "SHIP",
};

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
const state = {
  connected: false,
  currentStage: null,
  completedStages: new Set(),
  activeAgents: new Map(),    // id → { startAt, prompt }
  completedAgents: new Map(), // id → { lastAt, duration, summary }
  events: 0,
  files: 0,
  issues: { critical: 0, high: 0, med: 0, low: 0 },
  recent: [],                 // last ~10 events
  recentFiles: [],            // last ~6 { path, tool, agent, at }
  recentIssues: [],           // last ~5 { severity, title, at }
  sessionId: null,
  sessionStartAt: null,
  sessionEndAt: null,
  // Coherence: loaded from .claude/pipeline/*/coherence-report.md after coherence-auditor runs
  coherence: null,             // { score, status, feature, gaps, fabrications, edgesActual, edgesPossible, path, ts }
};

// ------------------------------------------------------------------
// Coherence report loader — reads .claude/pipeline/{feature}/coherence-report.md
// Triggered on agent.completed(coherence-auditor) or file.written(*/coherence-report.md)
// ------------------------------------------------------------------
function loadLatestCoherence() {
  try {
    const pipelineDir = join(process.cwd(), ".claude", "pipeline");
    if (!existsSync(pipelineDir)) return;
    const features = readdirSync(pipelineDir, { withFileTypes: true }).filter(d => d.isDirectory());
    let newest = null;
    for (const f of features) {
      const p = join(pipelineDir, f.name, "coherence-report.md");
      if (!existsSync(p)) continue;
      const s = statSync(p);
      if (!newest || s.mtimeMs > newest.mtime) {
        newest = { path: p, feature: f.name, mtime: s.mtimeMs };
      }
    }
    if (!newest) return;
    const content = readFileSync(newest.path, "utf8");
    // Tolerant parsing — coherence-auditor writes Korean or English.
    const score = parseInt(content.match(/Coordination Score\*?\*?:?\s*\*?\*?(\d+)\s*%/)?.[1] ?? "", 10);
    const edges = content.match(/\((\d+)\s*\/\s*(\d+)\s+edges?\)/);
    const status = content.match(/Status:\s*([A-Za-z]+)/)?.[1] ?? "";
    const fabrications = parseInt(content.match(/Fabrications?:\s*\*?\*?(\d+)/)?.[1] ?? "0", 10);
    // Gap count from "## Gaps (N)" heading
    const gaps = parseInt(content.match(/##\s*Gaps?\s*\((\d+)\)/)?.[1] ?? "0", 10);
    state.coherence = {
      score: Number.isFinite(score) ? score : null,
      status,
      feature: newest.feature,
      gaps,
      fabrications,
      edgesActual: edges ? parseInt(edges[1], 10) : null,
      edgesPossible: edges ? parseInt(edges[2], 10) : null,
      path: newest.path,
      ts: newest.mtime,
    };
    scheduleRender();
  } catch {
    // Swallow — coherence is best-effort, never crashes the watch
  }
}

function handleEvent(ev) {
  state.events += 1;
  const at = Date.parse(ev.at) || Date.now();
  if (!state.sessionStartAt) state.sessionStartAt = at;
  if (ev.session_id && !state.sessionId) state.sessionId = ev.session_id;

  switch (ev.type) {
    case "session.start":
      // New session → clear per-session state. Watch is a live observer for the
      // current session; persistent project progress belongs in docs/ (PDCA).
      // Keep: coherence (file-derived), session metadata itself.
      state.currentStage = null;
      state.completedStages = new Set();
      state.activeAgents = new Map();
      state.completedAgents = new Map();
      state.events = 0;
      state.files = 0;
      state.issues = { critical: 0, high: 0, med: 0, low: 0 };
      state.recent = [];
      state.recentFiles = [];
      state.recentIssues = [];
      state.sessionStartAt = at;
      state.sessionEndAt = null;
      if (ev.session_id) state.sessionId = ev.session_id;
      break;
    case "session.end":
      state.sessionEndAt = at;
      // Sweep any agents still marked active — completed events can be missed
      // (e.g. @mentions in prompt text that hook logs as dispatched but never
      // actually invoke the Agent tool). Session end implies nothing is running.
      for (const id of [...state.activeAgents.keys()]) {
        const a = state.activeAgents.get(id);
        state.activeAgents.delete(id);
        state.completedAgents.set(id, {
          lastAt: at,
          duration: Math.max(0, at - a.startAt),
          summary: "",
        });
      }
      break;
    case "agent.dispatched": {
      if (!ev.agent) break;
      state.activeAgents.set(ev.agent, { startAt: at, prompt: ev.prompt ?? "" });
      const stage = AGENT_STAGE[ev.agent];
      if (stage) {
        if (state.currentStage && state.currentStage !== stage) {
          state.completedStages.add(state.currentStage);
        }
        state.currentStage = stage;
      }
      break;
    }
    case "agent.completed": {
      const closeAgent = (id, closeAt) => {
        const a = state.activeAgents.get(id);
        const duration = a ? Math.max(0, closeAt - a.startAt) : 0;
        state.activeAgents.delete(id);
        state.completedAgents.set(id, {
          lastAt: closeAt,
          duration,
          summary: ev.output_summary ?? "",
        });
      };
      if (ev.agent) closeAgent(ev.agent, at);
      else if (ev.sweep) for (const id of [...state.activeAgents.keys()]) closeAgent(id, at);
      // Coherence: when coherence-auditor finishes, reload the latest report
      if (ev.agent === "coherence-auditor") {
        loadLatestCoherence();
      }
      break;
    }
    case "file.written":
      state.files += 1;
      // Coherence: if a coherence-report.md was just written, reload
      if (ev.path && ev.path.endsWith("/coherence-report.md")) {
        loadLatestCoherence();
      }
      if (ev.path) {
        state.recentFiles.push({ path: ev.path, tool: ev.tool_name, agent: ev.agent, at });
        if (state.recentFiles.length > 6) state.recentFiles.shift();
      }
      break;
    case "issue.found":
      if (ev.severity && state.issues[ev.severity] != null) {
        state.issues[ev.severity] += 1;
      }
      state.recentIssues.push({ severity: ev.severity, title: ev.title ?? "", at });
      if (state.recentIssues.length > 5) state.recentIssues.shift();
      break;
    case "pipeline.stage":
      if (state.currentStage) state.completedStages.add(state.currentStage);
      state.currentStage = (ev.stage ?? "").toUpperCase() || state.currentStage;
      break;
  }

  state.recent.push({ ...ev, at });
  if (state.recent.length > 14) state.recent.shift();
  scheduleRender();
}

// ------------------------------------------------------------------
// Render loop (throttled to ~20fps to avoid flicker on heavy event bursts)
// ------------------------------------------------------------------
let renderPending = false;
function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setImmediate(() => { renderPending = false; render(); });
}

function renderHeader() {
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

function sectionTitle(label, width) {
  const line = `${c.bold}${c.cyan}${label}${c.reset}`;
  const rule = c.gray + "─".repeat(Math.max(0, width - stripAnsi(line).length - 3)) + c.reset;
  return `${line} ${rule}`;
}

function renderNow(width) {
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

function renderPipeline(width) {
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

function renderAgents(width) {
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

function renderFiles(width) {
  if (state.recentFiles.length === 0) return;
  console.log(sectionTitle("FILES", width));
  for (const f of state.recentFiles.slice(-5)) {
    const rel = f.path.split("/").slice(-3).join("/");
    const by = f.agent ? ` ${c.gray}by ${f.agent}${c.reset}` : "";
    console.log(`  ${c.blue}📝${c.reset} ${rel} ${c.gray}(${f.tool ?? "edit"})${c.reset}${by}`);
  }
  console.log("");
}

function renderIssues(width) {
  if (state.recentIssues.length === 0) return;
  console.log(sectionTitle("ISSUES", width));
  for (const iss of state.recentIssues.slice(-3)) {
    const sev = iss.severity ?? "low";
    const color = sev === "critical" ? c.red : sev === "high" ? c.gold : c.gold;
    console.log(`  ${color}⚠${c.reset} ${color}${sev}${c.reset} ${c.gray}·${c.reset} ${truncate(iss.title, width - 16)}`);
  }
  console.log("");
}

function renderCoherence(width) {
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

function renderRecent(width) {
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

function render() {
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
    renderHeader();
    renderNow(width);
    renderPipeline(width);
    renderAgents(width);
    renderFiles(width);
    renderIssues(width);
    renderCoherence(width);
    renderRecent(width);
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
// JSONL tail — read existing history, then watch for new lines.
// ------------------------------------------------------------------
let tailOffset = 0;

async function ensureEventsFile() {
  try {
    mkdirSync(join(process.cwd(), ".claude", "buildcrew"), { recursive: true });
    if (!existsSync(EVENTS_PATH)) {
      // Create empty file so watchFile has something to watch
      closeSync(openSync(EVENTS_PATH, "a"));
    }
  } catch {}
}

async function replayExisting() {
  try {
    const st = statSync(EVENTS_PATH);
    tailOffset = st.size;
  } catch {
    tailOffset = 0;
    return;
  }
  // Empty events.jsonl (first run / fresh install) — nothing to replay.
  // createReadStream with end: -1 would throw RangeError.
  if (tailOffset === 0) {
    state.connected = true;
    scheduleRender();
    return;
  }
  const stream = createReadStream(EVENTS_PATH, { encoding: "utf8", end: tailOffset - 1 });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { handleEvent(JSON.parse(line)); } catch {}
  }
  state.connected = true;
  scheduleRender();
}

async function readNewBytes() {
  let st;
  try { st = statSync(EVENTS_PATH); } catch { return; }
  if (st.size < tailOffset) { tailOffset = 0; } // truncated / rotated
  if (st.size === tailOffset) return;
  const stream = createReadStream(EVENTS_PATH, {
    encoding: "utf8", start: tailOffset, end: st.size - 1,
  });
  let buf = "";
  stream.on("data", (chunk) => { buf += chunk; });
  await new Promise((resolve) => stream.on("end", resolve));
  tailOffset = st.size;
  const lines = buf.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try { handleEvent(JSON.parse(line)); } catch {}
  }
}

function subscribeTail() {
  watchFile(EVENTS_PATH, { interval: 400 }, () => { readNewBytes(); });
  // Also poll as a fallback in case watchFile misses writes
  setInterval(readNewBytes, 1000);
  state.connected = true;
}

// ------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------
// Enter alternate screen so the dashboard doesn't scribble over the user's
// scrollback. On exit we return the terminal to its pre-watch state.
process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
const restoreTerm = () => process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
process.on("exit", restoreTerm);
process.on("SIGINT", () => { restoreTerm(); process.exit(0); });
process.on("SIGTERM", () => { restoreTerm(); process.exit(0); });

// Keypress handlers: q/Ctrl-C quit, r open full coherence report
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (_str, key) => {
    if (key?.name === "q" || (key?.ctrl && key?.name === "c")) {
      process.stdout.write(SHOW_CURSOR);
      process.exit(0);
    }
    if (key?.name === "r") {
      // Open the full coherence report. Hand off the terminal to setup.js's
      // report subcommand which uses `less -R` for paging. Leave the alt
      // screen so less paints on the main buffer; re-enter on return.
      process.stdout.write(SHOW_CURSOR + ALT_SCREEN_OFF);
      process.stdin.setRawMode(false);
      const setupEntry = resolve(__dirname, "setup.js");
      spawnSync(process.execPath, [setupEntry, "report"], {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
      });
      // Restore raw mode + alt screen + hide cursor + redraw
      process.stdin.setRawMode(true);
      process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
      scheduleRender();
    }
  });
}

// Heartbeat redraw (updates elapsed even without events)
setInterval(scheduleRender, 1000);

// Tail the events.jsonl — replay history then watch for new lines
(async () => {
  await ensureEventsFile();
  await replayExisting();
  // Surface the latest coherence report (if any) on startup, even before any
  // new events fire — so users see their last score when they open watch.
  loadLatestCoherence();
  subscribeTail();
  render();
})();

// ------------------------------------------------------------------
// tiny utils
// ------------------------------------------------------------------
function truncate(s, n) {
  if (!s) return "";
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}
function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}
function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;]*m/g, ""); }
function padEnd(s, n) {
  const visible = stripAnsi(s);
  const padLen = Math.max(0, n - visible.length);
  return s + " ".repeat(padLen);
}
