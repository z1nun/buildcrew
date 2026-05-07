/**
 * lib/watch/state.js — events.jsonl → in-memory dashboard state.
 *
 * Owns the canonical view of "what is buildcrew doing right now":
 *   - parses one JSONL event at a time (handleEvent)
 *   - tails .claude/buildcrew/events.jsonl (replayExisting + subscribeTail)
 *   - reloads coherence-report.md when coherence-auditor finishes
 *
 * Pure-ish: handleEvent() only mutates the state object passed in. File I/O
 * is isolated to the loader functions so unit tests can drive handleEvent
 * with synthetic events and assert on state directly.
 *
 * The render layer reads this state. The input layer never touches it.
 */
import { createReadStream, watchFile, statSync, existsSync, mkdirSync, closeSync, openSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

// ------------------------------------------------------------------
// Agent roster — must stay in sync with dashboard/client/scenes/TownScene.js.
// Exposed here so render.js can render rosters and AGENT_STAGE can map
// completed agents back to pipeline stages.
// ------------------------------------------------------------------
export const AGENTS = [
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

export const STAGES = ["PLAN", "DESIGN", "DEV", "QA", "REVIEW", "SHIP"];
export const AGENT_STAGE = {
  planner: "PLAN", thinker: "PLAN",
  designer: "DESIGN", "design-reviewer": "DESIGN", architect: "DESIGN",
  developer: "DEV",
  "qa-tester": "QA", "browser-qa": "QA", "health-checker": "QA",
  "qa-auditor": "QA", "security-auditor": "QA", investigator: "QA",
  "canary-monitor": "QA",
  reviewer: "REVIEW",
  shipper: "SHIP",
};

/**
 * Build a fresh state object. Exported so tests can construct an isolated
 * state without sharing the module-level singleton.
 */
export function createState() {
  return {
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
    // Coherence: loaded from .claude/pipeline/*/coherence-report.md after
    // coherence-auditor runs.
    coherence: null,            // { score, status, feature, gaps, fabrications, edgesActual, edgesPossible, path, ts }
  };
}

/**
 * Apply one event to state.
 *
 * Side-effect contract: mutates state, calls onChange() at the end. onChange
 * is the render trigger; tests can pass a no-op.
 *
 * loadCoherence is injected so the coherence reload path can be unit-tested
 * with a stub. In production it points at loadLatestCoherence() below.
 */
export function handleEvent(state, ev, { onChange = () => {}, loadCoherence = () => {} } = {}) {
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
        loadCoherence();
      }
      break;
    }
    case "file.written":
      state.files += 1;
      // Coherence: if a coherence-report.md was just written, reload
      if (ev.path && ev.path.endsWith("/coherence-report.md")) {
        loadCoherence();
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
  onChange();
}

// ------------------------------------------------------------------
// Coherence report loader — reads .claude/pipeline/{feature}/coherence-report.md
// Triggered on agent.completed(coherence-auditor) or file.written(*/coherence-report.md)
// ------------------------------------------------------------------
export function loadLatestCoherence(state, { cwd = process.cwd(), onChange = () => {} } = {}) {
  try {
    const pipelineDir = join(cwd, ".claude", "pipeline");
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
    state.coherence = parseCoherenceReport(content, newest);
    onChange();
  } catch {
    // Swallow — coherence is best-effort, never crashes the watch
  }
}

/**
 * Parse a coherence-report.md body. Pulled out so it's unit-testable without
 * touching the filesystem. Tolerant of Korean or English; missing fields
 * become null/0 so the renderer can show "—" instead of crashing.
 */
export function parseCoherenceReport(content, meta = { path: "", feature: "", mtime: Date.now() }) {
  const score = parseInt(content.match(/Coordination Score\*?\*?:?\s*\*?\*?(\d+)\s*%/)?.[1] ?? "", 10);
  const edges = content.match(/\((\d+)\s*\/\s*(\d+)\s+edges?\)/);
  const status = content.match(/Status:\s*([A-Za-z]+)/)?.[1] ?? "";
  const fabrications = parseInt(content.match(/Fabrications?:\s*\*?\*?(\d+)/)?.[1] ?? "0", 10);
  // Gap count from "## Gaps (N)" heading
  const gaps = parseInt(content.match(/##\s*Gaps?\s*\((\d+)\)/)?.[1] ?? "0", 10);
  return {
    score: Number.isFinite(score) ? score : null,
    status,
    feature: meta.feature,
    gaps,
    fabrications,
    edgesActual: edges ? parseInt(edges[1], 10) : null,
    edgesPossible: edges ? parseInt(edges[2], 10) : null,
    path: meta.path,
    ts: meta.mtime,
  };
}

// ------------------------------------------------------------------
// JSONL tail — read existing history, then watch for new lines.
// ------------------------------------------------------------------

export function eventsPath(cwd = process.cwd()) {
  return process.env.BUILDCREW_EVENTS_PATH
    ?? join(cwd, ".claude", "buildcrew", "events.jsonl");
}

export async function ensureEventsFile(path) {
  try {
    mkdirSync(join(process.cwd(), ".claude", "buildcrew"), { recursive: true });
    if (!existsSync(path)) {
      // Create empty file so watchFile has something to watch
      closeSync(openSync(path, "a"));
    }
  } catch {}
}

/**
 * Replay everything currently in events.jsonl into state. Called once on
 * startup so opening watch mid-session shows the full history.
 *
 * Returns the byte offset to start tailing from. Caller threads this into
 * subscribeTail() via the offset object.
 */
export async function replayExisting(state, path, { onChange = () => {}, loadCoherence = () => {} } = {}) {
  let tailOffset;
  try {
    const st = statSync(path);
    tailOffset = st.size;
  } catch {
    return { tailOffset: 0 };
  }
  // Empty events.jsonl (first run / fresh install) — nothing to replay.
  // createReadStream with end: -1 would throw RangeError.
  if (tailOffset === 0) {
    state.connected = true;
    onChange();
    return { tailOffset: 0 };
  }
  const stream = createReadStream(path, { encoding: "utf8", end: tailOffset - 1 });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { handleEvent(state, JSON.parse(line), { onChange, loadCoherence }); } catch {}
  }
  state.connected = true;
  onChange();
  return { tailOffset };
}

/**
 * Read newly-appended bytes since the last call. The offset object is shared
 * across calls so it survives across watchFile and setInterval triggers.
 */
export async function readNewBytes(state, path, offset, { onChange = () => {}, loadCoherence = () => {} } = {}) {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.size < offset.tailOffset) { offset.tailOffset = 0; } // truncated / rotated
  if (st.size === offset.tailOffset) return;
  const stream = createReadStream(path, {
    encoding: "utf8", start: offset.tailOffset, end: st.size - 1,
  });
  let buf = "";
  stream.on("data", (chunk) => { buf += chunk; });
  await new Promise((resolve) => stream.on("end", resolve));
  offset.tailOffset = st.size;
  const lines = buf.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try { handleEvent(state, JSON.parse(line), { onChange, loadCoherence }); } catch {}
  }
}

/**
 * Subscribe to events.jsonl. Uses watchFile + a 1s poll fallback because
 * watchFile can miss writes on some filesystems (notably APFS with rapid
 * appends).
 */
export function subscribeTail(state, path, offset, { onChange = () => {}, loadCoherence = () => {} } = {}) {
  watchFile(path, { interval: 400 }, () => { readNewBytes(state, path, offset, { onChange, loadCoherence }); });
  // Also poll as a fallback in case watchFile misses writes
  setInterval(() => readNewBytes(state, path, offset, { onChange, loadCoherence }), 1000);
  state.connected = true;
}
