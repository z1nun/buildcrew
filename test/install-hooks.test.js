/**
 * Unit tests for lib/install-hooks.js — settings.json mutation logic.
 *
 * These functions touch the user's CC settings, so a regression here can
 * silently disable buildcrew (or worse, clobber unrelated hooks). The
 * happy path is covered by manual install testing; this suite locks down:
 *   - merge idempotency (re-running install replaces only buildcrew entries)
 *   - permission de-duplication
 *   - uninstall preserves non-buildcrew hooks
 *   - path resolution for project vs global scope
 *
 * Strategy: pure-function tests on mergeHooks/stripBuildcrewHooks via the
 * exported install/uninstall, driven against a tmp dir on the real fs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveSettingsPath, resolvePermissionsPath,
  buildcrewHooks, buildcrewPermissions,
  install, installPermissions, uninstall,
} from '../lib/install-hooks.js';

let tmp;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'buildcrew-test-'));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('resolveSettingsPath', () => {
  it('returns project path for project scope', () => {
    expect(resolveSettingsPath({ scope: 'project', cwd: '/proj' }))
      .toBe('/proj/.claude/settings.json');
  });

  it('returns global path for global scope (under HOME)', () => {
    const p = resolveSettingsPath({ scope: 'global', cwd: '/proj' });
    expect(p).toMatch(/\.claude\/settings\.json$/);
    expect(p).not.toBe('/proj/.claude/settings.json');
  });
});

describe('resolvePermissionsPath', () => {
  it('returns settings.local.json (NOT settings.json)', () => {
    // Important — permissions live in settings.local.json so they don't
    // get committed to git by default.
    expect(resolvePermissionsPath({ scope: 'project', cwd: '/proj' }))
      .toBe('/proj/.claude/settings.local.json');
  });
});

describe('buildcrewHooks shape', () => {
  it('emits all four CC hook events', () => {
    const h = buildcrewHooks();
    expect(Object.keys(h).sort()).toEqual(['PostToolUse', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
  });

  it('PostToolUse has both post-agent and file-written entries', () => {
    const h = buildcrewHooks();
    expect(h.PostToolUse).toHaveLength(2);
    expect(h.PostToolUse[0].matcher).toBe('Agent');
    expect(h.PostToolUse[1].matcher).toBe('Write|Edit|MultiEdit');
  });

  it('every entry is tagged with buildcrew-hook for idempotent re-install', () => {
    const h = buildcrewHooks();
    const flatten = (groups) => Object.values(groups).flat();
    for (const entry of flatten(h)) {
      expect(entry['buildcrew-hook']).toBe(true);
    }
  });

  it('hook command uses absolute node path (no npx)', () => {
    // Critical: bare `npx buildcrew-hook` E404s because there's no package
    // by that name. The installer pre-resolves the absolute hook.js path.
    const h = buildcrewHooks();
    const cmd = h.PreToolUse[0].hooks[0].command;
    expect(cmd.startsWith('node ')).toBe(true);
    expect(cmd).not.toMatch(/npx/);
    // Path is shell-escaped with double quotes (handles spaces/non-ASCII)
    expect(cmd).toMatch(/hook\.js" pre-agent$/);
  });
});

describe('buildcrewPermissions shape', () => {
  it('allows core CC tools and common bash commands', () => {
    const p = buildcrewPermissions();
    expect(p.allow).toContain('Agent');
    expect(p.allow).toContain('Read');
    expect(p.allow).toContain('Bash(git status*)');
  });

  it('denies destructive commands', () => {
    const p = buildcrewPermissions();
    expect(p.deny).toContain('Bash(rm -rf *)');
    expect(p.deny).toContain('Bash(sudo *)');
    expect(p.deny).toContain('Bash(git push --force*)');
  });
});

describe('install — fresh project', () => {
  it('creates .claude/settings.json with all four hook events', async () => {
    const result = await install({ scope: 'project', cwd: tmp });
    expect(result.action).toBe('installed');
    expect(result.existed).toBe(false);

    const settingsPath = join(tmp, '.claude', 'settings.json');
    const content = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(content.hooks).toBeDefined();
    expect(content.hooks.PreToolUse).toHaveLength(1);
    expect(content.hooks.PostToolUse).toHaveLength(2);
    expect(content.hooks.UserPromptSubmit).toHaveLength(1);
    expect(content.hooks.Stop).toHaveLength(1);
  });

  it('does not create a backup when no prior settings exist', async () => {
    await install({ scope: 'project', cwd: tmp });
    const dir = readdirSync(join(tmp, '.claude'));
    expect(dir.filter(f => f.includes('backup'))).toHaveLength(0);
  });
});

describe('install — preserves user state', () => {
  it('keeps unrelated hooks when adding buildcrew entries', async () => {
    // Simulate a user who already has a non-buildcrew hook configured.
    const settingsPath = join(tmp, '.claude', 'settings.json');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'my-custom-hook' }] }],
      },
      otherTopLevelKey: 'should-survive',
    }, null, 2));

    await install({ scope: 'project', cwd: tmp });

    const after = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(after.otherTopLevelKey).toBe('should-survive');
    // User's hook AND buildcrew's hook both exist
    expect(after.hooks.PreToolUse).toHaveLength(2);
    const userHook = after.hooks.PreToolUse.find(h => !h['buildcrew-hook']);
    expect(userHook.matcher).toBe('Bash');
    expect(userHook.hooks[0].command).toBe('my-custom-hook');
  });

  it('is idempotent: running install twice does not duplicate entries', async () => {
    await install({ scope: 'project', cwd: tmp });
    await install({ scope: 'project', cwd: tmp });

    const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
    // Still exactly one buildcrew PreToolUse entry, not two
    expect(settings.hooks.PreToolUse).toHaveLength(1);
    expect(settings.hooks.PostToolUse).toHaveLength(2); // post-agent + file-written
  });

  it('creates a backup when overwriting existing settings', async () => {
    const settingsPath = join(tmp, '.claude', 'settings.json');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({ hooks: {} }, null, 2));

    await install({ scope: 'project', cwd: tmp });

    const dir = readdirSync(join(tmp, '.claude'));
    const backup = dir.find(f => f.startsWith('settings.json.buildcrew-backup-'));
    expect(backup).toBeDefined();
  });
});

describe('installPermissions', () => {
  it('writes settings.local.json with allow/deny lists', async () => {
    const result = await installPermissions({ scope: 'project', cwd: tmp });
    expect(result.action).toBe('installed');

    const permPath = join(tmp, '.claude', 'settings.local.json');
    const content = JSON.parse(readFileSync(permPath, 'utf8'));
    expect(content.permissions.allow).toContain('Agent');
    expect(content.permissions.deny).toContain('Bash(rm -rf *)');
  });

  it('merges with existing permissions without duplicating entries', async () => {
    const permPath = join(tmp, '.claude', 'settings.local.json');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(permPath, JSON.stringify({
      permissions: {
        allow: ['Agent', 'CustomTool'],  // 'Agent' overlaps with buildcrew's recommendation
        deny: ['Bash(rm -rf *)'],         // overlaps too
      },
    }, null, 2));

    await installPermissions({ scope: 'project', cwd: tmp });

    const merged = JSON.parse(readFileSync(permPath, 'utf8'));
    // Custom tool survives, Agent appears exactly once
    expect(merged.permissions.allow).toContain('CustomTool');
    expect(merged.permissions.allow.filter(x => x === 'Agent')).toHaveLength(1);
    expect(merged.permissions.deny.filter(x => x === 'Bash(rm -rf *)')).toHaveLength(1);
  });

  it('install({ withPermissions: true }) writes both files', async () => {
    const result = await install({ scope: 'project', cwd: tmp, withPermissions: true });
    expect(result.permissions).not.toBeNull();
    expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(true);
    expect(existsSync(join(tmp, '.claude', 'settings.local.json'))).toBe(true);
  });
});

describe('uninstall', () => {
  it('removes only buildcrew entries, leaves user hooks intact', async () => {
    // Set up: user has a custom hook + we install buildcrew
    const settingsPath = join(tmp, '.claude', 'settings.json');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'my-custom-hook' }] }],
      },
    }, null, 2));
    await install({ scope: 'project', cwd: tmp });

    // Sanity — both hooks present after install
    let after = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(after.hooks.PreToolUse).toHaveLength(2);

    const result = await uninstall({ scope: 'project', cwd: tmp });
    expect(result.action).toBe('uninstalled');

    after = JSON.parse(readFileSync(settingsPath, 'utf8'));
    // Only the user hook remains
    expect(after.hooks.PreToolUse).toHaveLength(1);
    expect(after.hooks.PreToolUse[0].hooks[0].command).toBe('my-custom-hook');
    // PostToolUse / UserPromptSubmit / Stop had only buildcrew entries → fully removed
    expect(after.hooks.PostToolUse).toBeUndefined();
    expect(after.hooks.UserPromptSubmit).toBeUndefined();
    expect(after.hooks.Stop).toBeUndefined();
  });

  it('returns noop when no settings file exists', async () => {
    const result = await uninstall({ scope: 'project', cwd: tmp });
    expect(result.action).toBe('noop');
  });

  it('removes empty hooks key entirely when nothing remains', async () => {
    await install({ scope: 'project', cwd: tmp });
    await uninstall({ scope: 'project', cwd: tmp });

    const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
    // No leftover empty hooks: {} object
    expect(settings.hooks).toBeUndefined();
  });
});
