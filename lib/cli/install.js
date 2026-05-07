/**
 * lib/cli/install.js
 *
 * `npx buildcrew` (default subcommand) — install agents into .claude/agents/
 * and walk the user through the optional companion setup steps:
 *   1. Sync agent .md files (with version-aware update on existing installs)
 *   2. Playwright MCP for browser-driven agents
 *   3. Framer Motion for the designer agent
 *   4. GitHub CLI for the shipper agent
 *   5. CC hooks (banners + watch event stream)
 *   6. Project harness (delegates to runInit when missing)
 *
 * Also: `npx buildcrew --uninstall` → runUninstall.
 */

import { copyFile, mkdir, readdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  ask, exists, getVersion, log,
  AGENTS_SRC, HARNESS_DIR, TARGET_DIR,
  BOLD, CYAN, DIM, GREEN, RED, RESET, YELLOW,
} from "./utils.js";
import { runInit } from "./init.js";

// Agents that have been renamed/removed in past versions. We delete these
// from the user's .claude/agents/ on every install so the directory matches
// the current package shape.
const DEPRECATED_AGENTS = ["constitution.md"];

export async function runInstall(force) {
  const VERSION = await getVersion();
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));
  log(`\n  ${BOLD}buildcrew${RESET} v${VERSION}\n  ${DIM}17 AI agents for Claude Code${RESET}\n`);

  await mkdir(TARGET_DIR, { recursive: true });

  // Migrate: remove renamed agents from previous versions.
  for (const old of DEPRECATED_AGENTS) {
    const oldPath = join(TARGET_DIR, old);
    if (await exists(oldPath)) {
      await unlink(oldPath);
      log(`  ${YELLOW} ✕ ${RESET} ${old} ${DIM}(renamed → buildcrew.md)${RESET}`);
    }
  }

  // Sync each agent file. Three outcomes per file:
  //   - new install (target didn't exist) → copy
  //   - version bump (frontmatter `version:` differs) → copy + report
  //   - up-to-date → skip
  // With --force every file is overwritten unconditionally.
  let installed = 0, skipped = 0, updated = 0;

  for (const file of files) {
    const target = join(TARGET_DIR, file);
    if (await exists(target)) {
      if (force) {
        await copyFile(join(AGENTS_SRC, file), target);
        log(`  ${GREEN} + ${RESET} ${file} ${DIM}(overwritten)${RESET}`);
        installed++;
      } else {
        const installedContent = await readFile(target, "utf8");
        const sourceContent = await readFile(join(AGENTS_SRC, file), "utf8");
        const installedVer = (installedContent.match(/^version:\s*(.+)$/m) || [])[1];
        const sourceVer = (sourceContent.match(/^version:\s*(.+)$/m) || [])[1];
        if (sourceVer && installedVer && sourceVer !== installedVer) {
          await copyFile(join(AGENTS_SRC, file), target);
          log(`  ${CYAN} ↑ ${RESET} ${file} ${DIM}(${installedVer} → ${sourceVer})${RESET}`);
          updated++;
        } else {
          skipped++;
        }
      }
    } else {
      await copyFile(join(AGENTS_SRC, file), target);
      log(`  ${GREEN} + ${RESET} ${file}`);
      installed++;
    }
  }

  log("");
  const parts = [];
  if (installed > 0) parts.push(`${installed} installed`);
  if (updated > 0) parts.push(`${updated} updated`);
  if (skipped > 0) parts.push(`${skipped} up-to-date`);
  if (installed > 0 || updated > 0) log(`  ${GREEN}${BOLD}Done!${RESET} ${parts.join(", ")}.\n`);
  else log(`  ${GREEN}All agents up-to-date.${RESET} (v${VERSION})\n`);

  // ─── Companion setup steps ───
  await offerPlaywrightMcp();
  await offerFramerMotion();
  await offerGitHubCli();
  await offerHooks();
  await offerHarness();

  log(`  ${BOLD}Start:${RESET}  @buildcrew [your request]\n`);
}

export async function runUninstall() {
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));
  if (!(await exists(TARGET_DIR))) {
    log(`${YELLOW}No agents found.${RESET}`);
    return;
  }
  let removed = 0;
  for (const file of files) {
    const target = join(TARGET_DIR, file);
    if (await exists(target)) {
      await unlink(target);
      removed++;
    }
  }
  log(`${GREEN}Removed ${removed} agent files.${RESET}`);
}

// Detect if CC hooks are wired up by looking for buildcrew-hook in settings.
// Returns false on any error (missing file, bad JSON, etc.).
export async function areHooksInstalled() {
  try {
    const settingsPath = join(process.cwd(), ".claude", "settings.json");
    const content = await readFile(settingsPath, "utf-8");
    return content.includes("buildcrew-hook");
  } catch {
    return false;
  }
}

// ─── Companion installer helpers ───
// Each is a best-effort prompt. Failures are logged but never throw — install
// succeeds even if every companion step bails out.

async function offerPlaywrightMcp() {
  try {
    const { execSync } = await import("node:child_process");
    const mcpList = execSync("claude mcp list 2>/dev/null", { encoding: "utf8" });
    if (!mcpList.includes("playwright")) {
      log(`  ${YELLOW}Playwright MCP${RESET} is needed for browser testing agents.`);
      log(`  ${DIM}Used by: browser-qa, design-reviewer, canary-monitor, designer${RESET}\n`);
      const answer = await ask(`  Install Playwright MCP now? ${BOLD}(Y/n)${RESET} `);
      if (answer === "" || answer === "y" || answer === "yes") {
        log(`\n  ${DIM}Running: claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright${RESET}\n`);
        try {
          execSync("claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright", { stdio: "inherit" });
          log(`\n  ${GREEN}${BOLD}Playwright MCP installed!${RESET}\n`);
        } catch {
          log(`\n  ${RED}Failed to install.${RESET} Run manually:`);
          log(`  ${BOLD}claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright${RESET}\n`);
        }
      } else {
        log(`\n  ${DIM}Skipped. Run later: claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright${RESET}\n`);
      }
    } else {
      log(`  ${GREEN}Playwright MCP:${RESET} installed ✓\n`);
    }
  } catch { /* claude CLI not available, skip */ }
}

async function offerFramerMotion() {
  try {
    const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!allDeps["framer-motion"]) {
      log(`  ${YELLOW}Framer Motion${RESET} is needed for designer agent animations.`);
      log(`  ${DIM}Used by: designer (entrance, scroll, hover, page transitions)${RESET}\n`);
      const answer = await ask(`  Install Framer Motion now? ${BOLD}(Y/n)${RESET} `);
      if (answer === "" || answer === "y" || answer === "yes") {
        const { execSync } = await import("node:child_process");
        log(`\n  ${DIM}Running: npm install framer-motion${RESET}\n`);
        try {
          execSync("npm install framer-motion", { stdio: "inherit", cwd: process.cwd() });
          log(`\n  ${GREEN}${BOLD}Framer Motion installed!${RESET}\n`);
        } catch {
          log(`\n  ${RED}Failed to install.${RESET} Run manually: ${BOLD}npm install framer-motion${RESET}\n`);
        }
      } else {
        log(`\n  ${DIM}Skipped. Run later: npm install framer-motion${RESET}\n`);
      }
    } else {
      log(`  ${GREEN}Framer Motion:${RESET} installed ✓\n`);
    }
  } catch { /* no package.json, skip */ }
}

async function offerGitHubCli() {
  try {
    const { execSync } = await import("node:child_process");
    execSync("which gh 2>/dev/null", { encoding: "utf8" });
    log(`  ${GREEN}GitHub CLI:${RESET} installed ✓\n`);
  } catch {
    log(`  ${YELLOW}GitHub CLI (gh)${RESET} is needed for shipper agent PR creation.`);
    log(`  ${DIM}Used by: shipper (gh pr create, auto push + PR)${RESET}\n`);
    const answer = await ask(`  Install GitHub CLI now? ${BOLD}(Y/n)${RESET} `);
    if (answer === "" || answer === "y" || answer === "yes") {
      try {
        const { execSync } = await import("node:child_process");
        const platform = process.platform;
        if (platform === "darwin") {
          log(`\n  ${DIM}Running: brew install gh${RESET}\n`);
          execSync("brew install gh", { stdio: "inherit" });
        } else if (platform === "linux") {
          log(`\n  ${DIM}Running: sudo apt install gh${RESET}\n`);
          execSync("sudo apt install gh -y", { stdio: "inherit" });
        } else {
          log(`\n  ${DIM}Visit: https://cli.github.com/${RESET}\n`);
        }
        log(`\n  ${GREEN}${BOLD}GitHub CLI installed!${RESET} Run ${BOLD}gh auth login${RESET} to authenticate.\n`);
      } catch {
        log(`\n  ${RED}Failed to install.${RESET} Visit: ${BOLD}https://cli.github.com/${RESET}\n`);
      }
    } else {
      log(`\n  ${DIM}Skipped. Without gh, shipper will output PR description for manual creation.${RESET}\n`);
    }
  }
}

async function offerHooks() {
  try {
    const hooksInstalled = await areHooksInstalled();
    if (hooksInstalled) {
      log(`  ${GREEN}Hooks:${RESET} installed ✓\n`);
      return;
    }
    log(`  ${YELLOW}Hooks${RESET} print a colored banner to your terminal whenever an`);
    log(`  agent starts/completes or a file is written. Also feeds ${BOLD}npx buildcrew watch${RESET}.`);
    log(`  ${DIM}Writes .claude/settings.json (+ recommended permissions)${RESET}\n`);
    const answer = await ask(`  Install hooks? ${BOLD}(Y/n)${RESET} `);
    if (answer === "" || answer === "y" || answer === "yes") {
      try {
        const { install } = await import("../install-hooks.js");
        const result = await install({
          scope: "project",
          cwd: process.cwd(),
          withPermissions: true,
        });
        log(`\n  ${GREEN}${BOLD}Hooks installed!${RESET}`);
        log(`  ${DIM}  hooks:       ${result.settingsPath}${RESET}`);
        if (result.permissions?.permPath) {
          log(`  ${DIM}  permissions: ${result.permissions.permPath}${RESET}`);
        }
        log(`\n  ${BOLD}Live monitor:${RESET} ${CYAN}npx buildcrew watch${RESET} ${DIM}(in a separate pane)${RESET}\n`);
      } catch (err) {
        log(`\n  ${RED}Hook install failed:${RESET} ${err.message}\n`);
      }
    } else {
      log(`\n  ${DIM}Skipped. Hooks not installed.${RESET}\n`);
    }
  } catch { /* ignore, non-fatal */ }
}

async function offerHarness() {
  if (!(await exists(join(HARNESS_DIR, "project.md")))) {
    const initAnswer = await ask(`  Generate project harness? ${DIM}(auto-detects your stack)${RESET} ${BOLD}(Y/n)${RESET} `);
    if (initAnswer === "" || initAnswer === "y" || initAnswer === "yes") {
      log("");
      await runInit(false);
    } else {
      log(`\n  ${DIM}Skipped. Run later: npx buildcrew init${RESET}\n`);
    }
  } else {
    log(`  ${GREEN}Project harness:${RESET} exists ✓\n`);
  }
}
