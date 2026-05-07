/**
 * Unit tests for lib/hook.js — toEvents() contract.
 *
 * toEvents converts CC's hook payload into events.jsonl entries. If this
 * mapping breaks, watch shows the wrong dashboard or the dashboard goes
 * silent for some event types — the kind of bug we don't notice until a
 * user complains. Lock the contract with synthetic CC payloads.
 *
 * lib/hook.js auto-runs main() on import (it's a CLI entry point), so we
 * set BUILDCREW_HOOK_TEST=1 BEFORE the import to skip the auto-run. This
 * env guard is intentionally documented in lib/hook.js.
 */
import { describe, it, expect, beforeAll } from 'vitest';

// MUST set this BEFORE the import — vitest hoists imports above other code,
// but vi.mock-style env setup via beforeAll runs after imports. Use
// import.meta to trigger before module body executes.
process.env.BUILDCREW_HOOK_TEST = '1';

const { toEvents } = await import('../lib/hook.js');

describe('toEvents — pre-agent', () => {
  it('emits agent.dispatched with subagent_type, prompt, session_id', () => {
    const events = toEvents('pre-agent', {
      session_id: 'abc123',
      tool_input: { subagent_type: 'planner', prompt: 'plan a feature' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'agent.dispatched',
      agent: 'planner',
      from: 'buildcrew',
      prompt: 'plan a feature',
      session_id: 'abc123',
    });
  });

  it('falls back to "agent" when subagent_type missing', () => {
    const events = toEvents('pre-agent', { session_id: 'x', tool_input: {} });
    expect(events[0].agent).toBe('agent');
  });

  it('falls back to description when prompt missing', () => {
    const events = toEvents('pre-agent', {
      session_id: 'x',
      tool_input: { subagent_type: 'qa-tester', description: 'run tests' },
    });
    expect(events[0].prompt).toBe('run tests');
  });

  it('truncates long prompts to 400 chars + ellipsis', () => {
    const longPrompt = 'a'.repeat(500);
    const events = toEvents('pre-agent', {
      session_id: 'x',
      tool_input: { subagent_type: 'planner', prompt: longPrompt },
    });
    expect(events[0].prompt.length).toBe(400);
    expect(events[0].prompt.endsWith('…')).toBe(true);
  });

  it('uses "unknown" session_id when CC payload omits it', () => {
    const events = toEvents('pre-agent', {
      tool_input: { subagent_type: 'planner', prompt: 'hi' },
    });
    expect(events[0].session_id).toBe('unknown');
  });
});

describe('toEvents — post-agent', () => {
  it('emits agent.completed with output_summary from string response', () => {
    const events = toEvents('post-agent', {
      session_id: 'abc',
      tool_input: { subagent_type: 'developer' },
      tool_response: 'wrote 3 files',
    });
    expect(events[0]).toMatchObject({
      type: 'agent.completed',
      agent: 'developer',
      output_summary: 'wrote 3 files',
      session_id: 'abc',
    });
  });

  it('extracts text from structured CC response (content[0].text)', () => {
    const events = toEvents('post-agent', {
      session_id: 'abc',
      tool_input: { subagent_type: 'reviewer' },
      tool_response: { content: [{ text: 'review complete: 2 issues' }] },
    });
    expect(events[0].output_summary).toBe('review complete: 2 issues');
  });

  it('truncates output_summary to 500 chars', () => {
    const big = 'x'.repeat(1000);
    const events = toEvents('post-agent', {
      session_id: 'abc',
      tool_input: { subagent_type: 'planner' },
      tool_response: big,
    });
    expect(events[0].output_summary.length).toBe(500);
  });

  it('returns empty summary when response is missing/malformed', () => {
    const events = toEvents('post-agent', {
      session_id: 'abc',
      tool_input: { subagent_type: 'planner' },
    });
    expect(events[0].output_summary).toBe('');
  });
});

describe('toEvents — file-written', () => {
  it('emits file.written with path, tool_name, agent', () => {
    const events = toEvents('file-written', {
      session_id: 'abc',
      tool_input: { file_path: '/abs/foo.md' },
      tool_name: 'Write',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'file.written',
      path: '/abs/foo.md',
      tool_name: 'Write',
      session_id: 'abc',
    });
  });

  it('returns empty array when no file_path (e.g. failed write)', () => {
    const events = toEvents('file-written', { session_id: 'abc', tool_input: {} });
    expect(events).toHaveLength(0);
  });

  it('defaults agent to "buildcrew" when payload has no agent (pipeline-violation signal)', () => {
    // CC doesn't pass "current subagent" info to file hooks. We default to
    // buildcrew (team lead) so the dashboard exposes when the lead writes
    // files directly — which violates Feature mode delegation rules.
    const events = toEvents('file-written', {
      session_id: 'abc',
      tool_input: { file_path: '/abs/x.md' },
      tool_name: 'Write',
    });
    expect(events[0].agent).toBe('buildcrew');
  });

  it('respects explicit agent field if present', () => {
    const events = toEvents('file-written', {
      session_id: 'abc',
      agent: 'developer',
      tool_input: { file_path: '/abs/x.md' },
      tool_name: 'Edit',
    });
    expect(events[0].agent).toBe('developer');
  });
});

describe('toEvents — user-prompt', () => {
  it('emits a single session.start when no @mentions are present', () => {
    const events = toEvents('user-prompt', {
      session_id: 'abc',
      prompt: 'just a plain prompt',
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session.start');
    expect(events[0].session_id).toBe('abc');
    expect(events[0].mode).toBe('feature');
  });

  it('emits agent.dispatched per @mention', () => {
    const events = toEvents('user-prompt', {
      session_id: 'abc',
      prompt: 'hey @planner can you also tell @reviewer to check this',
    });
    expect(events).toHaveLength(3); // session.start + planner + reviewer
    expect(events[0].type).toBe('session.start');
    expect(events[1].type).toBe('agent.dispatched');
    expect(events[1].agent).toBe('planner');
    expect(events[1].from).toBe('user');
    expect(events[2].agent).toBe('reviewer');
  });

  it('deduplicates repeated @mentions in the same prompt', () => {
    const events = toEvents('user-prompt', {
      session_id: 'abc',
      prompt: '@planner do X then @planner also do Y',
    });
    // Only one planner agent.dispatched event, plus session.start
    expect(events).toHaveLength(2);
    expect(events.filter(e => e.type === 'agent.dispatched')).toHaveLength(1);
  });

  it('mentions are case-insensitive but normalized to lowercase', () => {
    const events = toEvents('user-prompt', {
      session_id: 'abc',
      prompt: '@PLANNER and @Designer',
    });
    expect(events.filter(e => e.type === 'agent.dispatched').map(e => e.agent))
      .toEqual(['planner', 'designer']);
  });

  it('mention regex requires whitespace or start-of-string before @', () => {
    // Email addresses or doc references shouldn't trigger
    const events = toEvents('user-prompt', {
      session_id: 'abc',
      prompt: 'send to user@example.com about the plan',
    });
    expect(events.filter(e => e.type === 'agent.dispatched')).toHaveLength(0);
  });

  it('synthesizes a session_id when CC omits one', () => {
    const events = toEvents('user-prompt', {
      prompt: 'no session id here',
    });
    expect(events[0].session_id).toMatch(/^cc-\d+$/);
  });
});

describe('toEvents — subagent-stop', () => {
  it('emits agent.completed with sweep:true (no specific agent)', () => {
    const events = toEvents('subagent-stop', { session_id: 'abc' });
    expect(events).toEqual([{
      type: 'agent.completed',
      agent: null,
      sweep: true,
      session_id: 'abc',
    }]);
  });
});

describe('toEvents — session-end', () => {
  it('emits session.end with outcome:success', () => {
    const events = toEvents('session-end', { session_id: 'abc' });
    expect(events).toEqual([{
      type: 'session.end',
      session_id: 'abc',
      outcome: 'success',
    }]);
  });
});

describe('toEvents — unknown kind', () => {
  it('returns empty array (no crash, no spurious events)', () => {
    expect(toEvents('not-a-real-kind', {})).toEqual([]);
  });
});
