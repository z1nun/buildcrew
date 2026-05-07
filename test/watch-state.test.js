/**
 * Unit tests for lib/watch/state.js — the events.jsonl parser.
 *
 * Why: this parser sits between the CC hook and the dashboard. If it
 * mis-handles an event type the dashboard goes silent or shows wrong info,
 * and the bug only surfaces when a real session runs. Lock the contract.
 *
 * Strategy: drive handleEvent() with synthetic events on a fresh state
 * object and assert state mutations. No filesystem, no rendering.
 */
import { describe, it, expect } from 'vitest';
import {
  AGENTS, STAGES, AGENT_STAGE,
  createState, handleEvent, parseCoherenceReport,
} from '../lib/watch/state.js';

describe('createState', () => {
  it('returns a fresh, empty state', () => {
    const s = createState();
    expect(s.connected).toBe(false);
    expect(s.events).toBe(0);
    expect(s.files).toBe(0);
    expect(s.activeAgents.size).toBe(0);
    expect(s.completedAgents.size).toBe(0);
    expect(s.completedStages.size).toBe(0);
    expect(s.issues).toEqual({ critical: 0, high: 0, med: 0, low: 0 });
    expect(s.recent).toEqual([]);
    expect(s.recentFiles).toEqual([]);
    expect(s.recentIssues).toEqual([]);
    expect(s.coherence).toBeNull();
  });

  it('returns independent state objects (no shared references)', () => {
    const a = createState();
    const b = createState();
    a.activeAgents.set('planner', { startAt: 1, prompt: 'x' });
    expect(b.activeAgents.size).toBe(0);
  });
});

describe('roster constants', () => {
  it('AGENTS has 16 agents (matches dashboard TownScene roster)', () => {
    expect(AGENTS).toHaveLength(16);
  });

  it('every AGENT_STAGE entry maps to a known STAGES value', () => {
    for (const [agent, stage] of Object.entries(AGENT_STAGE)) {
      expect(STAGES).toContain(stage);
      // And the agent must exist in AGENTS
      expect(AGENTS.find(a => a.id === agent), `${agent} missing from AGENTS`).toBeDefined();
    }
  });
});

describe('handleEvent — basic counters', () => {
  it('increments events count for any event', () => {
    const s = createState();
    handleEvent(s, { type: 'unknown.type', at: '2026-05-07T00:00:00Z' });
    expect(s.events).toBe(1);
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner', at: '2026-05-07T00:00:01Z' });
    expect(s.events).toBe(2);
  });

  it('captures sessionId from first event that has one', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner', session_id: 'abc12345' });
    expect(s.sessionId).toBe('abc12345');
    // Subsequent different session_ids are ignored — first one wins until session.start
    handleEvent(s, { type: 'agent.dispatched', agent: 'developer', session_id: 'zzz99999' });
    expect(s.sessionId).toBe('abc12345');
  });

  it('calls onChange after each event', () => {
    const s = createState();
    let count = 0;
    handleEvent(s, { type: 'unknown.type' }, { onChange: () => { count++; } });
    handleEvent(s, { type: 'unknown.type' }, { onChange: () => { count++; } });
    expect(count).toBe(2);
  });
});

describe('handleEvent — session.start', () => {
  it('clears per-session state but preserves coherence', () => {
    const s = createState();
    s.activeAgents.set('planner', { startAt: 1, prompt: 'x' });
    s.completedAgents.set('developer', { lastAt: 2, duration: 100, summary: '' });
    s.events = 50;
    s.files = 10;
    s.issues = { critical: 1, high: 2, med: 3, low: 4 };
    s.coherence = { score: 95, status: 'COHERENT' };

    handleEvent(s, { type: 'session.start', session_id: 'newsession', at: '2026-05-07T00:00:00Z' });

    expect(s.activeAgents.size).toBe(0);
    expect(s.completedAgents.size).toBe(0);
    // session.start runs the counter increment first, then resets to 0 — so
    // the session.start event itself does NOT show up in the new counter.
    // This is intentional: the next event after session.start is event #1.
    expect(s.events).toBe(0);
    expect(s.files).toBe(0);
    expect(s.issues).toEqual({ critical: 0, high: 0, med: 0, low: 0 });
    expect(s.sessionId).toBe('newsession');
    // Coherence is file-derived, not per-session — must survive
    expect(s.coherence).toEqual({ score: 95, status: 'COHERENT' });
  });
});

describe('handleEvent — agent lifecycle', () => {
  it('agent.dispatched marks agent active and sets stage', () => {
    const s = createState();
    handleEvent(s, {
      type: 'agent.dispatched',
      agent: 'planner',
      prompt: 'plan a feature',
      at: '2026-05-07T00:00:00Z',
    });
    expect(s.activeAgents.has('planner')).toBe(true);
    expect(s.activeAgents.get('planner').prompt).toBe('plan a feature');
    expect(s.currentStage).toBe('PLAN');
  });

  it('agent.completed moves agent from active → completed with duration', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'developer', at: '2026-05-07T00:00:00Z' });
    handleEvent(s, {
      type: 'agent.completed',
      agent: 'developer',
      output_summary: 'wrote 3 files',
      at: '2026-05-07T00:00:30Z',
    });
    expect(s.activeAgents.has('developer')).toBe(false);
    const done = s.completedAgents.get('developer');
    expect(done.summary).toBe('wrote 3 files');
    expect(done.duration).toBe(30000); // 30s
  });

  it('agent.completed with sweep:true closes ALL active agents', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner', at: '2026-05-07T00:00:00Z' });
    handleEvent(s, { type: 'agent.dispatched', agent: 'developer', at: '2026-05-07T00:00:00Z' });
    handleEvent(s, { type: 'agent.completed', sweep: true, at: '2026-05-07T00:00:10Z' });
    expect(s.activeAgents.size).toBe(0);
    expect(s.completedAgents.size).toBe(2);
  });

  it('agent.completed with no agent + no sweep is a no-op for activeAgents', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner' });
    handleEvent(s, { type: 'agent.completed' }); // malformed event
    expect(s.activeAgents.has('planner')).toBe(true);
  });

  it('changing stage marks the previous stage completed', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner' });   // PLAN
    handleEvent(s, { type: 'agent.dispatched', agent: 'developer' }); // DEV
    expect(s.completedStages.has('PLAN')).toBe(true);
    expect(s.currentStage).toBe('DEV');
  });

  it('coherence-auditor completion triggers loadCoherence callback', () => {
    const s = createState();
    let coherenceLoadCount = 0;
    handleEvent(s,
      { type: 'agent.completed', agent: 'coherence-auditor' },
      { loadCoherence: () => { coherenceLoadCount++; } }
    );
    expect(coherenceLoadCount).toBe(1);
  });
});

describe('handleEvent — session.end sweep', () => {
  it('closes any agents still marked active', () => {
    const s = createState();
    handleEvent(s, { type: 'agent.dispatched', agent: 'planner', at: '2026-05-07T00:00:00Z' });
    handleEvent(s, { type: 'agent.dispatched', agent: 'reviewer', at: '2026-05-07T00:00:00Z' });
    handleEvent(s, { type: 'session.end', at: '2026-05-07T00:01:00Z' });
    expect(s.activeAgents.size).toBe(0);
    expect(s.completedAgents.size).toBe(2);
    expect(s.sessionEndAt).toBe(Date.parse('2026-05-07T00:01:00Z'));
  });
});

describe('handleEvent — file.written', () => {
  it('increments files counter and pushes to recentFiles', () => {
    const s = createState();
    handleEvent(s, {
      type: 'file.written',
      path: '/tmp/foo.md',
      tool_name: 'Write',
      agent: 'planner',
      at: '2026-05-07T00:00:00Z',
    });
    expect(s.files).toBe(1);
    expect(s.recentFiles).toHaveLength(1);
    expect(s.recentFiles[0].path).toBe('/tmp/foo.md');
    expect(s.recentFiles[0].agent).toBe('planner');
  });

  it('caps recentFiles at 6 entries (rolling window)', () => {
    const s = createState();
    for (let i = 0; i < 10; i++) {
      handleEvent(s, { type: 'file.written', path: `/tmp/f${i}.md` });
    }
    expect(s.recentFiles).toHaveLength(6);
    expect(s.recentFiles[0].path).toBe('/tmp/f4.md');
    expect(s.recentFiles[5].path).toBe('/tmp/f9.md');
    // But total counter is unaffected by the window
    expect(s.files).toBe(10);
  });

  it('coherence-report.md write triggers loadCoherence callback', () => {
    const s = createState();
    let count = 0;
    handleEvent(s,
      { type: 'file.written', path: '/abs/.claude/pipeline/feat/coherence-report.md' },
      { loadCoherence: () => { count++; } }
    );
    expect(count).toBe(1);
  });

  it('non-coherence file.written does not trigger loadCoherence', () => {
    const s = createState();
    let count = 0;
    handleEvent(s,
      { type: 'file.written', path: '/abs/some-other-file.md' },
      { loadCoherence: () => { count++; } }
    );
    expect(count).toBe(0);
  });
});

describe('handleEvent — issue.found', () => {
  it('increments severity bucket and tracks recentIssues', () => {
    const s = createState();
    handleEvent(s, { type: 'issue.found', severity: 'high', title: 'XSS in render' });
    handleEvent(s, { type: 'issue.found', severity: 'critical', title: 'SQL injection' });
    expect(s.issues.high).toBe(1);
    expect(s.issues.critical).toBe(1);
    expect(s.recentIssues).toHaveLength(2);
    expect(s.recentIssues[1].title).toBe('SQL injection');
  });

  it('ignores unknown severity values without crashing', () => {
    const s = createState();
    handleEvent(s, { type: 'issue.found', severity: 'apocalyptic', title: 'unknown' });
    expect(s.issues).toEqual({ critical: 0, high: 0, med: 0, low: 0 });
    // But it still goes into recentIssues for visibility
    expect(s.recentIssues).toHaveLength(1);
  });

  it('caps recentIssues at 5', () => {
    const s = createState();
    for (let i = 0; i < 8; i++) {
      handleEvent(s, { type: 'issue.found', severity: 'low', title: `bug ${i}` });
    }
    expect(s.recentIssues).toHaveLength(5);
  });
});

describe('handleEvent — pipeline.stage', () => {
  it('moves currentStage forward and marks the prior one complete', () => {
    const s = createState();
    handleEvent(s, { type: 'pipeline.stage', stage: 'plan' });
    expect(s.currentStage).toBe('PLAN');
    handleEvent(s, { type: 'pipeline.stage', stage: 'dev' });
    expect(s.completedStages.has('PLAN')).toBe(true);
    expect(s.currentStage).toBe('DEV');
  });
});

describe('handleEvent — recent log', () => {
  it('caps recent at 14 entries', () => {
    const s = createState();
    for (let i = 0; i < 20; i++) {
      handleEvent(s, { type: 'agent.dispatched', agent: `agent${i}` });
    }
    expect(s.recent).toHaveLength(14);
    // Newest survives
    expect(s.recent[13].agent).toBe('agent19');
  });
});

describe('parseCoherenceReport', () => {
  const meta = { path: '/p/coherence-report.md', feature: 'feat-x', mtime: 1234 };

  it('extracts score, status, edges, gaps, fabrications', () => {
    const md = `# Report
Coordination Score: **87%** (12/14 edges)
Status: COHERENT
Fabrications: 0

## Gaps (2)
- gap A
- gap B
`;
    const result = parseCoherenceReport(md, meta);
    expect(result).toEqual({
      score: 87,
      status: 'COHERENT',
      feature: 'feat-x',
      gaps: 2,
      fabrications: 0,
      edgesActual: 12,
      edgesPossible: 14,
      path: '/p/coherence-report.md',
      ts: 1234,
    });
  });

  it('returns null score when no Coordination Score line present', () => {
    const result = parseCoherenceReport('# Empty report\n', meta);
    expect(result.score).toBeNull();
    expect(result.gaps).toBe(0);
    expect(result.fabrications).toBe(0);
    expect(result.edgesActual).toBeNull();
    expect(result.edgesPossible).toBeNull();
  });

  it('handles "edge" singular as well as "edges"', () => {
    const md = `Coordination Score: 50% (1/1 edge)\n`;
    const result = parseCoherenceReport(md, meta);
    expect(result.edgesActual).toBe(1);
    expect(result.edgesPossible).toBe(1);
  });

  it('returns 0 fabrications when omitted', () => {
    const md = `Coordination Score: 100% (1/1 edge)\n`;
    expect(parseCoherenceReport(md, meta).fabrications).toBe(0);
  });
});
