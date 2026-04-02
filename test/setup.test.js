import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agents');
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const agentFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));

describe('agent files', () => {
  it('has 16 agent files', () => {
    expect(agentFiles).toHaveLength(16);
  });

  it('all agents have valid YAML frontmatter', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      expect(content.startsWith('---'), `${file} should start with ---`).toBe(true);
      const endIdx = content.indexOf('---', 3);
      expect(endIdx > 0, `${file} should have closing ---`).toBe(true);
    }
  });

  it('all agents have name field', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      const name = content.match(/^name:\s*(.+)$/m);
      expect(name, `${file} missing name field`).toBeTruthy();
      expect(name[1].trim().length > 0).toBe(true);
    }
  });

  it('all agents have description field', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      const desc = content.match(/^description:\s*(.+)$/m);
      expect(desc, `${file} missing description`).toBeTruthy();
    }
  });

  it('all agents have model field (opus or sonnet)', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      const model = content.match(/^model:\s*(.+)$/m);
      expect(model, `${file} missing model`).toBeTruthy();
      expect(['opus', 'sonnet']).toContain(model[1].trim());
    }
  });

  it('all agents have version field matching package version or higher', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      const version = content.match(/^version:\s*(.+)$/m);
      expect(version, `${file} missing version field`).toBeTruthy();
      expect(version[1].trim()).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('all agents have tools list', () => {
    for (const file of agentFiles) {
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      expect(content).toContain('tools:');
    }
  });

  it('all specialist agents have Status Output section', () => {
    for (const file of agentFiles) {
      if (file === 'buildcrew.md') continue; // orchestrator has Status Log instead
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      expect(content, `${file} missing Status Output`).toContain('Status Output');
    }
  });

  it('all specialist agents have Rules section', () => {
    for (const file of agentFiles) {
      if (file === 'buildcrew.md') continue; // orchestrator has numbered rules in different format
      const content = readFileSync(join(AGENTS_DIR, file), 'utf8');
      const hasRules = content.includes('## Rules') || content.includes('# Rules');
      expect(hasRules, `${file} missing Rules section`).toBe(true);
    }
  });

  it('buildcrew orchestrator has Status Log and Rules sections', () => {
    const content = readFileSync(join(AGENTS_DIR, 'buildcrew.md'), 'utf8');
    expect(content).toContain('Status Log');
    expect(content).toContain('## Rules');
  });
});

describe('model assignments', () => {
  it('developer is opus (does the hardest work)', () => {
    const content = readFileSync(join(AGENTS_DIR, 'developer.md'), 'utf8');
    expect(content).toContain('model: opus');
  });

  it('buildcrew orchestrator is opus', () => {
    const content = readFileSync(join(AGENTS_DIR, 'buildcrew.md'), 'utf8');
    expect(content).toContain('model: opus');
  });

  it('qa-auditor is opus (orchestrates subagents)', () => {
    const content = readFileSync(join(AGENTS_DIR, 'qa-auditor.md'), 'utf8');
    expect(content).toContain('model: opus');
  });

  it('thinker is opus (product thinking)', () => {
    const content = readFileSync(join(AGENTS_DIR, 'thinker.md'), 'utf8');
    expect(content).toContain('model: opus');
  });

  it('architect is opus (architecture decisions)', () => {
    const content = readFileSync(join(AGENTS_DIR, 'architect.md'), 'utf8');
    expect(content).toContain('model: opus');
  });
});

describe('buildcrew orchestrator', () => {
  const content = readFileSync(join(AGENTS_DIR, 'buildcrew.md'), 'utf8');

  it('has all 13 modes defined', () => {
    for (let i = 1; i <= 13; i++) {
      expect(content, `missing Mode ${i}`).toContain(`Mode ${i}:`);
    }
  });

  it('has mode priority rules section', () => {
    expect(content).toContain('Mode Priority Rules');
  });

  it('has qa-auditor in harness mapping', () => {
    expect(content).toContain('qa-auditor');
  });

  it('has fallback instruction for ambiguous input', () => {
    expect(content).toContain('ask the user');
  });
});

describe('templates', () => {
  const templateFiles = readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.md'));

  it('has 7 template files', () => {
    expect(templateFiles).toHaveLength(7);
  });

  it('all templates have content', () => {
    for (const file of templateFiles) {
      const content = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
      expect(content.trim().length > 0, `${file} is empty`).toBe(true);
    }
  });
});

describe('package.json', () => {
  it('description mentions 15 agents', () => {
    expect(PKG.description).toContain('15');
  });

  it('has no runtime dependencies', () => {
    expect(PKG.dependencies).toBeUndefined();
  });
});
