/**
 * Session state store.
 * All scenes subscribe here and re-render when state changes.
 * Single source of truth for the monitoring view.
 */

export const STAGES = ["PLAN", "DESIGN", "DEV", "QA", "REVIEW", "SHIP"];

const initialState = () => ({
  sessionStartAt: null,         // Date.ms when session.start received (or first event)
  sessionEndAt: null,
  currentStage: null,           // one of STAGES, or null if not started
  stageHistory: [],             // [{stage, startAt, endAt}]
  // Per-agent activity: array of {start, end} segments
  agentSegments: new Map(),     // agentId → [{start, end}]
  agentActive: new Map(),       // agentId → start timestamp if currently active
  // Counters
  eventCount: 0,
  fileCount: 0,
  issues: { low: 0, med: 0, high: 0, critical: 0 },
  // Issue titles (for timeline markers)
  issueMarkers: [],             // [{at, severity, title}]
  fileMarkers: [],              // [{at, agent, path}]
  // Per-session metadata (NOT scene-rendered, used by log panel + statusbar)
  sessions: new Map(),          // sessionId → { color, firstSeen, lastSeen, active, eventCount, lastPrompt }
});

// Distinct-looking colors for sessions. Cycles if more than 8 sessions.
const SESSION_PALETTE = [
  "#7ee0a2", // green
  "#5aa9ff", // blue
  "#ffb84a", // orange
  "#cc6fe3", // purple
  "#f5a3c7", // pink
  "#70d7b2", // teal
  "#ff8566", // coral
  "#d5d8e0", // silver
];

const ACTIVE_TIMEOUT_MS = 5 * 60 * 1000; // session idle > 5min → inactive

class SessionStore {
  constructor() {
    this.state = initialState();
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.state);
  }

  reset() {
    this.state = initialState();
    this.emit();
  }

  handleEvent(ev) {
    const s = this.state;
    s.eventCount += 1;
    const at = Date.parse(ev.at) || Date.now();

    if (!s.sessionStartAt) s.sessionStartAt = at;

    // Track per-session metadata (independent of aggregate state)
    this.trackSession(ev, at);

    switch (ev.type) {
      case "session.start":
        s.sessionStartAt = at;
        s.sessionEndAt = null;
        break;
      case "session.end":
        s.sessionEndAt = at;
        // Close any still-active agents
        for (const [agent, startAt] of s.agentActive) {
          const segs = s.agentSegments.get(agent) ?? [];
          segs.push({ start: startAt, end: at });
          s.agentSegments.set(agent, segs);
        }
        s.agentActive.clear();
        // Close current stage
        if (s.currentStage && s.stageHistory.length > 0) {
          const last = s.stageHistory[s.stageHistory.length - 1];
          if (!last.endAt) last.endAt = at;
        }
        break;
      case "pipeline.stage": {
        const stageName = String(ev.stage ?? "").toUpperCase();
        if (!STAGES.includes(stageName)) break;
        // Close previous stage
        if (s.stageHistory.length > 0) {
          const last = s.stageHistory[s.stageHistory.length - 1];
          if (!last.endAt) last.endAt = at;
        }
        s.currentStage = stageName;
        s.stageHistory.push({ stage: stageName, startAt: at, endAt: null });
        break;
      }
      case "agent.dispatched": {
        const a = ev.agent;
        if (!a) break;
        s.agentActive.set(a, at);
        break;
      }
      case "agent.completed": {
        const a = ev.agent;
        if (!a) break;
        const startAt = s.agentActive.get(a);
        if (startAt) {
          const segs = s.agentSegments.get(a) ?? [];
          segs.push({ start: startAt, end: at });
          s.agentSegments.set(a, segs);
          s.agentActive.delete(a);
        }
        break;
      }
      case "file.written":
        s.fileCount += 1;
        if (ev.path) s.fileMarkers.push({ at, agent: ev.agent ?? "unknown", path: ev.path });
        break;
      case "issue.found": {
        const sev = ev.severity;
        if (sev && s.issues[sev] != null) s.issues[sev] += 1;
        s.issueMarkers.push({ at, severity: sev, title: ev.title ?? "" });
        break;
      }
    }

    this.emit();
  }

  trackSession(ev, at) {
    const sid = ev.session_id;
    if (!sid) return;
    const sessions = this.state.sessions;
    let meta = sessions.get(sid);
    if (!meta) {
      const idx = sessions.size;
      meta = {
        id: sid,
        color: SESSION_PALETTE[idx % SESSION_PALETTE.length],
        firstSeen: at,
        lastSeen: at,
        active: true,
        eventCount: 0,
        lastPrompt: null,
      };
      sessions.set(sid, meta);
    }
    meta.lastSeen = at;
    meta.eventCount += 1;
    meta.active = true;
    if (ev.type === "session.end") meta.active = false;
    if (ev.type === "agent.dispatched" && ev.from === "buildcrew") {
      meta.lastPrompt = ev.prompt ?? meta.lastPrompt;
    }
  }

  sessionColor(sessionId) {
    return this.state.sessions.get(sessionId)?.color ?? "#8a93a7";
  }

  allSessions() {
    return [...this.state.sessions.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  activeSessions() {
    const now = Date.now();
    return this.allSessions().filter((s) => s.active && (now - s.lastSeen) < ACTIVE_TIMEOUT_MS);
  }

  // -------- derived values --------

  stageIndex() {
    const cur = this.state.currentStage;
    return cur ? STAGES.indexOf(cur) : -1;
  }

  stageStatuses() {
    const s = this.state;
    const completed = new Set();
    for (const entry of s.stageHistory) {
      if (entry.endAt) completed.add(entry.stage);
    }
    return STAGES.map((name) => {
      if (completed.has(name)) return { name, status: "done" };
      if (name === s.currentStage) return { name, status: "active" };
      return { name, status: "pending" };
    });
  }

  elapsedMs() {
    const s = this.state;
    if (!s.sessionStartAt) return 0;
    const end = s.sessionEndAt ?? Date.now();
    return end - s.sessionStartAt;
  }

  activeAgents() {
    return [...this.state.agentActive.keys()];
  }
}

export const session = new SessionStore();
