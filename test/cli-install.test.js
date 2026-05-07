/**
 * Unit tests for lib/cli/install.js — only the pure helpers.
 *
 * runInstall() is heavy (interactive prompts, child_process for brew/npm,
 * playwright MCP probing) and is exercised manually + by the agent file
 * checks in setup.test.js. Here we lock down areHooksInstalled() since
 * it gates the "Install hooks?" prompt and a regression silently re-prompts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { areHooksInstalled } from '../lib/cli/install.js';

let tmp;
let originalCwd;

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), 'buildcrew-install-test-'));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tmp, { recursive: true, force: true });
});

describe('areHooksInstalled', () => {
  it('returns false when .claude/settings.json is missing', async () => {
    expect(await areHooksInstalled()).toBe(false);
  });

  it('returns false when settings.json has no buildcrew-hook', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(
      join(tmp, '.claude', 'settings.json'),
      JSON.stringify({ hooks: {} }),
    );
    expect(await areHooksInstalled()).toBe(false);
  });

  it('returns true when settings.json contains buildcrew-hook', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(
      join(tmp, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ hooks: [{ command: 'npx buildcrew-hook' }] }],
        },
      }),
    );
    expect(await areHooksInstalled()).toBe(true);
  });

  it('returns false on malformed JSON (non-fatal)', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude', 'settings.json'), 'not json');
    // The function's contract is "return false on any failure" — and
    // malformed settings shouldn't claim hooks are installed.
    const result = await areHooksInstalled();
    // areHooksInstalled uses includes() on raw text, so "not json" returns
    // false because it doesn't contain "buildcrew-hook". This is intentional.
    expect(result).toBe(false);
  });
});
