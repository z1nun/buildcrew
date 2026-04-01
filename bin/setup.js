#!/usr/bin/env node

import { readdir, copyFile, mkdir, readFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_SRC = join(__dirname, "..", "agents");
const TARGET_DIR = join(process.cwd(), ".claude", "agents");

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
  const uninstall = args.includes("--uninstall");

  if (help) {
    log(`
${BOLD}claude-constitution${RESET} — 11 AI agents for Claude Code

${BOLD}Usage:${RESET}
  npx claude-constitution          Install agents to .claude/agents/
  npx claude-constitution --force  Overwrite existing agent files
  npx claude-constitution --list   List all agents without installing
  npx claude-constitution --uninstall  Remove installed agent files

${BOLD}Agents:${RESET}
  ${CYAN}Build Team${RESET}      planner, designer, developer
  ${GREEN}Quality Team${RESET}    qa-tester, browser-qa, reviewer, health-checker
  ${MAGENTA}Security & Ops${RESET}  security-auditor, canary-monitor, shipper
  ${YELLOW}Specialist${RESET}      investigator

${BOLD}Modes:${RESET}
  Feature, Project Audit, Browser QA, Security Audit,
  Debug, Health Check, Canary, Review, Ship

${BOLD}After install:${RESET}
  @constitution [your request]
`);
    return;
  }

  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));

  if (list) {
    log(`\n${BOLD}claude-constitution${RESET} — 11 agents\n`);
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
  log(`\n${BOLD}claude-constitution${RESET} v1.0.0\n`);
  log(`${DIM}Installing 11 agents to ${TARGET_DIR}${RESET}\n`);

  await mkdir(TARGET_DIR, { recursive: true });

  let installed = 0;
  let skipped = 0;

  for (const file of files) {
    const target = join(TARGET_DIR, file);
    if ((await exists(target)) && !force) {
      log(`  ${YELLOW}skip${RESET}  ${file} ${DIM}(already exists, use --force to overwrite)${RESET}`);
      skipped++;
      continue;
    }
    await copyFile(join(AGENTS_SRC, file), target);
    log(`  ${GREEN}copy${RESET}  ${file}`);
    installed++;
  }

  log("");
  if (installed > 0) {
    log(`${GREEN}${BOLD}Done!${RESET} ${installed} agents installed.${skipped > 0 ? ` ${skipped} skipped.` : ""}`);
  } else {
    log(`${YELLOW}All agents already exist.${RESET} Use ${BOLD}--force${RESET} to overwrite.`);
  }

  log(`
${BOLD}Quick start:${RESET}
  ${CYAN}@constitution${RESET} [feature request]     Feature mode
  ${CYAN}@constitution${RESET} 브라우저 테스트해줘    Browser QA
  ${CYAN}@constitution${RESET} 보안 점검해줘          Security audit
  ${CYAN}@constitution${RESET} 헬스체크 돌려줘        Health check
  ${CYAN}@constitution${RESET} 코드 리뷰해줘          Code review
  ${CYAN}@constitution${RESET} 배포해줘               Ship

${DIM}Tip: Constitution auto-detects the mode from your request.${RESET}
`);
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
