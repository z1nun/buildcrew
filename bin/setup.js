#!/usr/bin/env node

import { readdir, copyFile, mkdir, readFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_SRC = join(__dirname, "..", "agents");
const TARGET_DIR = join(process.cwd(), ".claude", "agents");
const VERSION = "1.0.0";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";

function log(msg) { console.log(msg); }

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force") || args.includes("-f");
  const list = args.includes("--list") || args.includes("-l");
  const help = args.includes("--help") || args.includes("-h");
  const version = args.includes("--version") || args.includes("-v");
  const uninstall = args.includes("--uninstall");

  if (version) {
    log(`buildcrew v${VERSION}`);
    return;
  }

  if (help) {
    log(`
${BOLD}buildcrew${RESET} v${VERSION} — 11 AI agents for Claude Code

${BOLD}Usage:${RESET}
  npx buildcrew              Install agents to .claude/agents/
  npx buildcrew --force      Overwrite existing agent files
  npx buildcrew --list       List all agents without installing
  npx buildcrew --uninstall  Remove installed agent files
  npx buildcrew --version    Show version

${BOLD}Agents (11):${RESET}
  ${CYAN}Build Team${RESET}      planner, designer, developer
  ${GREEN}Quality Team${RESET}    qa-tester, browser-qa, reviewer, health-checker
  ${MAGENTA}Security & Ops${RESET}  security-auditor, canary-monitor, shipper
  ${YELLOW}Specialist${RESET}      investigator

${BOLD}9 Modes:${RESET}
  Feature, Project Audit, Browser QA, Security Audit,
  Debug, Health Check, Canary, Review, Ship

${BOLD}Requirements:${RESET}
  - Claude Code CLI (claude.ai/code)
  - Playwright MCP (optional, for browser-qa & canary-monitor)
    Setup: claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright

${BOLD}After install:${RESET}
  @constitution [your request]

${BOLD}More info:${RESET}
  https://github.com/z1nun/buildcrew
`);
    return;
  }

  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));

  if (list) {
    log(`\n${BOLD}buildcrew${RESET} v${VERSION} — 11 agents\n`);
    for (const file of files) {
      const content = await readFile(join(AGENTS_SRC, file), "utf8");
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      const descMatch = content.match(/^description:\s*(.+)$/m);
      const name = nameMatch ? nameMatch[1] : file.replace(".md", "");
      const desc = descMatch ? descMatch[1] : "";
      const isConstitution = name === "constitution";
      const color = isConstitution ? BOLD : "";
      log(`  ${color}${name.padEnd(20)}${RESET} ${DIM}${desc.slice(0, 70)}${RESET}`);
    }
    log("");
    return;
  }

  if (uninstall) {
    if (!(await exists(TARGET_DIR))) {
      log(`${YELLOW}No .claude/agents/ directory found. Nothing to uninstall.${RESET}`);
      return;
    }
    let removed = 0;
    for (const file of files) {
      const target = join(TARGET_DIR, file);
      if (await exists(target)) {
        const { unlink } = await import("fs/promises");
        await unlink(target);
        removed++;
      }
    }
    log(`${GREEN}Removed ${removed} agent files from .claude/agents/${RESET}`);
    return;
  }

  // Install
  log(`
  ${BOLD}buildcrew${RESET} v${VERSION}
  ${DIM}11 AI agents for Claude Code${RESET}
`);
  log(`${DIM}Installing to ${TARGET_DIR}${RESET}\n`);

  await mkdir(TARGET_DIR, { recursive: true });

  let installed = 0;
  let skipped = 0;

  for (const file of files) {
    const target = join(TARGET_DIR, file);
    if ((await exists(target)) && !force) {
      log(`  ${YELLOW}skip${RESET}  ${file} ${DIM}(exists, use --force)${RESET}`);
      skipped++;
      continue;
    }
    await copyFile(join(AGENTS_SRC, file), target);
    log(`  ${GREEN} +  ${RESET} ${file}`);
    installed++;
  }

  log("");
  if (installed > 0) {
    log(`  ${GREEN}${BOLD}Done!${RESET} ${installed} agents installed.${skipped > 0 ? ` ${skipped} skipped.` : ""}\n`);
  } else {
    log(`  ${YELLOW}All agents already exist.${RESET} Use ${BOLD}--force${RESET} to overwrite.\n`);
  }

  // Check for Playwright MCP
  let hasPlaywright = false;
  try {
    const settingsPath = join(process.env.HOME, ".claude", "settings.json");
    if (await exists(settingsPath)) {
      const settings = await readFile(settingsPath, "utf8");
      hasPlaywright = settings.includes("playwright");
    }
  } catch {}

  if (!hasPlaywright) {
    log(`  ${YELLOW}Optional:${RESET} Playwright MCP not detected.`);
    log(`  ${DIM}browser-qa and canary-monitor need it for real browser testing.${RESET}`);
    log(`  ${DIM}Setup: claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright${RESET}\n`);
  }

  log(`${BOLD}  Quick start:${RESET}
  ${CYAN}@constitution${RESET} Add user dashboard        Feature mode
  ${CYAN}@constitution${RESET} browser qa localhost:3000  Browser QA
  ${CYAN}@constitution${RESET} security audit             Security audit
  ${CYAN}@constitution${RESET} health check               Health dashboard
  ${CYAN}@constitution${RESET} code review                Code review
  ${CYAN}@constitution${RESET} ship                       Release + PR
  ${CYAN}@constitution${RESET} debug: login broken        Root cause debug
  ${CYAN}@constitution${RESET} full project audit         Full scan + fix

  ${DIM}Constitution auto-detects the mode from your message.${RESET}
`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
