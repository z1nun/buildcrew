/**
 * Tests for the Agent Skills distribution (skills/ source tree + syncSkills).
 *
 * Source-shape tests mirror setup.test.js for agents: every skills/<dir> must
 * contain a SKILL.md whose frontmatter follows the Agent Skills standard
 * (name matching the directory, non-empty description) plus the `version:`
 * field our installer's version-aware update logic keys on.
 *
 * syncSkills() is exercised in a tmp cwd via vi.resetModules() + dynamic
 * import, because lib/cli/utils.js resolves SKILLS_TARGET_DIR from
 * process.cwd() at module load time.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const PKG = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);

describe('skill files', () => {
  it('has 7 skills (orchestrator + 6 mode groups)', () => {
    expect(skillDirs.sort()).toEqual([
      'buildcrew',
      'buildcrew-debug',
      'buildcrew-qa',
      'buildcrew-review',
      'buildcrew-security',
      'buildcrew-ship',
      'buildcrew-think',
    ]);
  });

  it('every skill dir contains a SKILL.md with valid frontmatter', () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      expect(content.startsWith('---'), `${dir} should start with ---`).toBe(true);
      expect(content.indexOf('---', 3) > 0, `${dir} should have closing ---`).toBe(true);
    }
  });

  it('skill name matches its directory name', () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      const name = (content.match(/^name:\s*(.+)$/m) || [])[1];
      expect(name?.trim(), `${dir} name mismatch`).toBe(dir);
    }
  });

  it('every skill has a non-empty description', () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      const desc = (content.match(/^description:\s*(.+)$/m) || [])[1];
      expect(desc?.trim().length, `${dir} missing description`).toBeGreaterThan(20);
    }
  });

  it('every skill has a version matching the package version', () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      const version = (content.match(/^version:\s*(.+)$/m) || [])[1];
      expect(version?.trim(), `${dir} version out of date`).toBe(PKG.version);
    }
  });

  it('every skill points at the agent role definitions', () => {
    for (const dir of skillDirs) {
      const content = readFileSync(join(SKILLS_DIR, dir, 'SKILL.md'), 'utf8');
      expect(content, `${dir} should reference .claude/agents/`).toContain('.claude/agents/');
    }
  });
});

describe('syncSkills', () => {
  let tmp;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'buildcrew-skills-test-'));
    process.chdir(tmp);
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  async function freshSyncSkills() {
    const { syncSkills } = await import('../lib/cli/install.js');
    return syncSkills;
  }

  it('fresh install copies every skill into .claude/skills/', async () => {
    const syncSkills = await freshSyncSkills();
    const result = await syncSkills(false);
    expect(result.installed).toBe(skillDirs.length);
    for (const dir of skillDirs) {
      const installed = readFileSync(join(tmp, '.claude', 'skills', dir, 'SKILL.md'), 'utf8');
      expect(installed).toContain(`name: ${dir}`);
    }
  });

  it('second run skips everything (same version)', async () => {
    const syncSkills = await freshSyncSkills();
    await syncSkills(false);
    const result = await syncSkills(false);
    expect(result.installed).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(skillDirs.length);
  });

  it('outdated installed version gets updated', async () => {
    const syncSkills = await freshSyncSkills();
    await syncSkills(false);
    const target = join(tmp, '.claude', 'skills', 'buildcrew', 'SKILL.md');
    writeFileSync(target, readFileSync(target, 'utf8').replace(/^version:.*$/m, 'version: 0.0.1'));
    const result = await syncSkills(false);
    expect(result.updated).toBe(1);
    expect(readFileSync(target, 'utf8')).toContain(`version: ${PKG.version}`);
  });

  it('force overwrites even when up-to-date', async () => {
    const syncSkills = await freshSyncSkills();
    await syncSkills(false);
    const result = await syncSkills(true);
    expect(result.installed).toBe(skillDirs.length);
    expect(result.skipped).toBe(0);
  });
});
