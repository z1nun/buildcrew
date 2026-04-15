/**
 * Handoff Record coverage tests
 *
 * Verifies that all 15 producing agents declare the Handoff Record requirement
 * in their prompt, that coherence-auditor exists with the right structure,
 * and that buildcrew orchestrator enforces the rule.
 *
 * Background: docs/02-design/coordination-verifiability.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agents');

const PRODUCING_AGENTS = [
  'planner',
  'plan-challenger',
  'designer',
  'spec-challenger',
  'developer',
  'qa-tester',
  'browser-qa',
  'reviewer',
  'health-checker',
  'security-auditor',
  'canary-monitor',
  'shipper',
  'thinker',
  'architect',
  'design-reviewer',
  'investigator',
  'qa-auditor',
];

// Specialized agents that must include extra Coordination signals fields
// (per docs/02-design §5)
const SPECIALIZED_AGENTS = {
  reviewer: 'Verified Handoff Records of',
  thinker: 'Assumption chain',
  'design-reviewer': 'UX score provenance',
  investigator: 'Root cause trace',
  'qa-auditor': 'Subagent findings consolidation',
};

function readAgent(name) {
  return readFileSync(join(AGENTS_DIR, `${name}.md`), 'utf8');
}

describe('Handoff Record requirement', () => {
  it.each(PRODUCING_AGENTS)('%s.md mentions Handoff Record', (agent) => {
    const content = readAgent(agent);
    expect(content).toContain('Handoff Record');
  });

  it.each(PRODUCING_AGENTS)('%s.md requires the 3 mandatory subsections', (agent) => {
    const content = readAgent(agent);
    expect(content, `${agent} missing 'Inputs consumed' subsection`).toContain('Inputs consumed');
    expect(content, `${agent} missing 'Outputs for next agents' subsection`).toContain('Outputs for next agents');
    expect(content, `${agent} missing 'Decisions NOT covered by inputs' subsection`).toContain('Decisions NOT covered by inputs');
  });
});

describe('Specialized agents have extra fields', () => {
  for (const [agent, marker] of Object.entries(SPECIALIZED_AGENTS)) {
    it(`${agent}.md has specialized field "${marker}"`, () => {
      const content = readAgent(agent);
      expect(content, `${agent} missing specialized field`).toContain(marker);
    });
  }
});

describe('coherence-auditor (meta agent)', () => {
  const content = readAgent('coherence-auditor');

  it('declared as opus model (Q3 code-judgment requires)', () => {
    expect(content).toContain('model: opus');
  });

  it('has 5-Phase workflow markers', () => {
    expect(content).toContain('Phase 1: Handoff Record Parsing');
    expect(content).toContain('Phase 2: Markdown Reference Resolution');
    expect(content).toContain('Phase 3: Source Code Cross-Verification');
    expect(content).toContain('Phase 4: Edge Graph');
    expect(content).toContain('Phase 5');
  });

  it('declares 3 verdict states for code verification', () => {
    expect(content).toContain('CONFIRMED');
    expect(content).toContain('PARTIAL');
    expect(content).toContain('MISSING_IN_CODE');
  });

  it('writes report to coherence-report.md', () => {
    expect(content).toContain('coherence-report.md');
  });
});

describe('buildcrew orchestrator enforces Handoff Record', () => {
  const content = readAgent('buildcrew');

  it('lists coherence-auditor in Team Members table', () => {
    expect(content).toContain('coherence-auditor');
    expect(content).toContain('Meta');
  });

  it('Mode 1 pipeline includes coherence-auditor as final step', () => {
    expect(content).toMatch(/reviewer\s*→\s*\*?\*?coherence-auditor/);
  });

  it('has enforcement rule about Handoff Record', () => {
    expect(content).toContain('Handoff Record');
    // Some numbered rule must mention Handoff Record (position flexible across versions)
    expect(content).toMatch(/\d+\.\s+\*\*[^*]*Handoff Record/);
  });

  it('📊 buildcrew Report includes Coordination Score line', () => {
    expect(content).toContain('Coordination Score');
  });

  it('warns on Theater (Score < 50%)', () => {
    expect(content).toContain('< 50%');
    expect(content).toContain('Theater');
  });
});

describe('design doc cross-reference', () => {
  it('buildcrew.md references the design doc', () => {
    const content = readAgent('buildcrew');
    expect(content).toContain('docs/02-design/coordination-verifiability.md');
  });
});
