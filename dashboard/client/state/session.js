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
});

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
