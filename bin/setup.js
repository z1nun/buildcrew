#!/usr/bin/env node

import { readdir, copyFile, mkdir, readFile, writeFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_SRC = join(__dirname, "..", "agents");
const TEMPLATES_SRC = join(__dirname, "..", "templates");
const TARGET_DIR = join(process.cwd(), ".claude", "agents");
const HARNESS_DIR = join(process.cwd(), ".claude", "harness");
const VERSION = "1.0.0";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const RED = "\x1b[31m";

function log(msg) { console.log(msg); }

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

// ─── Interactive prompt ───

function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(resolve => rl.question(q, resolve));
  const close = () => rl.close();
  return { ask, close };
}

// ─── Auto-detect project info ───

async function detectProject() {
  const info = { name: "", stack: [], framework: "", hasTS: false, hasTailwind: false, hasI18n: false, hasAuth: false, hasDB: false };

  // package.json
  try {
    const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf8"));
    info.name = pkg.name || "";
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (allDeps["next"]) { info.framework = "Next.js"; info.stack.push("Next.js"); }
    else if (allDeps["nuxt"]) { info.framework = "Nuxt"; info.stack.push("Nuxt"); }
    else if (allDeps["react"]) { info.framework = "React"; info.stack.push("React"); }
    else if (allDeps["vue"]) { info.framework = "Vue"; info.stack.push("Vue"); }
    else if (allDeps["svelte"] || allDeps["@sveltejs/kit"]) { info.framework = "SvelteKit"; info.stack.push("SvelteKit"); }
    else if (allDeps["express"]) { info.framework = "Express"; info.stack.push("Express"); }

    if (allDeps["typescript"]) { info.hasTS = true; info.stack.push("TypeScript"); }
    if (allDeps["tailwindcss"]) { info.hasTailwind = true; info.stack.push("TailwindCSS"); }
    if (allDeps["next-intl"] || allDeps["i18next"] || allDeps["react-intl"]) { info.hasI18n = true; info.stack.push("i18n"); }
    if (allDeps["@supabase/supabase-js"]) { info.hasDB = true; info.stack.push("Supabase"); }
    else if (allDeps["prisma"] || allDeps["@prisma/client"]) { info.hasDB = true; info.stack.push("Prisma"); }
    else if (allDeps["drizzle-orm"]) { info.hasDB = true; info.stack.push("Drizzle"); }
    if (allDeps["next-auth"] || allDeps["@auth/core"] || allDeps["@supabase/auth-helpers-nextjs"]) { info.hasAuth = true; info.stack.push("Auth"); }
    if (allDeps["stripe"] || allDeps["@paddle/paddle-js"]) { info.stack.push("Payments"); }
  } catch {}

  return info;
}

// ─── Init: Harness Engineering ───

async function runInit(force) {
  log(`\n  ${BOLD}buildcrew init${RESET} — Harness Engineering Setup\n`);
  log(`  ${DIM}Setting up project context, team rules, and domain knowledge.${RESET}`);
  log(`  ${DIM}This helps all 11 agents understand YOUR project specifically.${RESET}\n`);

  if ((await exists(join(HARNESS_DIR, "project.md"))) && !force) {
    log(`  ${YELLOW}Harness already exists at .claude/harness/${RESET}`);
    log(`  ${DIM}Use ${BOLD}npx buildcrew init --force${RESET}${DIM} to overwrite.${RESET}\n`);
    return;
  }

  const detected = await detectProject();
  const { ask, close } = createPrompt();

  try {
    // ─── Section 1: Project ───
    log(`  ${CYAN}${BOLD}[1/3] Project Context${RESET}\n`);

    const name = (await ask(`  ${BOLD}Project name${RESET} ${DIM}(${detected.name || "detected: none"})${RESET}: `)) || detected.name || "my-project";
    const description = await ask(`  ${BOLD}What does this project do?${RESET} (1 sentence): `);
    const stackAuto = detected.stack.length > 0 ? detected.stack.join(", ") : "not detected";
    const stackExtra = await ask(`  ${BOLD}Tech stack${RESET} ${DIM}(detected: ${stackAuto})${RESET}\n  ${DIM}Add anything missing (comma-separated, or press Enter):${RESET} `);
    const deployTarget = await ask(`  ${BOLD}Deploy target${RESET} ${DIM}(Vercel, AWS, Netlify, etc.)${RESET}: `);
    const prodUrl = await ask(`  ${BOLD}Production URL${RESET} ${DIM}(or press Enter to skip)${RESET}: `);

    // ─── Section 2: Team Rules ───
    log(`\n  ${CYAN}${BOLD}[2/3] Team Rules (Constitution)${RESET}`);
    log(`  ${DIM}Define the rules your AI team must follow.${RESET}\n`);

    const conventions = await ask(`  ${BOLD}Coding conventions${RESET}\n  ${DIM}(e.g., "functional components only", "no default exports", "Korean comments")${RESET}\n  : `);
    const priorities = await ask(`  ${BOLD}What to prioritize${RESET}\n  ${DIM}(e.g., "UX over performance", "security first", "ship fast")${RESET}\n  : `);
    const avoid = await ask(`  ${BOLD}What to avoid${RESET}\n  ${DIM}(e.g., "no class components", "no any types", "avoid lodash")${RESET}\n  : `);
    const quality = await ask(`  ${BOLD}Quality standards${RESET}\n  ${DIM}(e.g., "all code must pass tsc", "100% i18n coverage", "no console.log")${RESET}\n  : `);
    const reviewRules = await ask(`  ${BOLD}Review rules${RESET}\n  ${DIM}(e.g., "always check auth on API routes", "mobile-first", "test edge cases")${RESET}\n  : `);

    // ─── Section 3: Domain ───
    log(`\n  ${CYAN}${BOLD}[3/3] Domain Knowledge${RESET}`);
    log(`  ${DIM}Help agents understand your business context.${RESET}\n`);

    const domain = await ask(`  ${BOLD}Domain/industry${RESET} ${DIM}(e.g., "e-commerce", "SaaS", "fintech", "education")${RESET}: `);
    const userTypes = await ask(`  ${BOLD}User types${RESET} ${DIM}(e.g., "free users, premium users, admins")${RESET}: `);
    const keyTerms = await ask(`  ${BOLD}Key domain terms${RESET}\n  ${DIM}(e.g., "reading=tarot session, spread=card layout, interpretation=AI analysis")${RESET}\n  : `);
    const businessRules = await ask(`  ${BOLD}Important business rules${RESET}\n  ${DIM}(e.g., "free users get 3 readings/day", "payment must complete before access")${RESET}\n  : `);

    close();

    // ─── Generate files ───
    await mkdir(HARNESS_DIR, { recursive: true });

    const fullStack = [...detected.stack, ...(stackExtra ? stackExtra.split(",").map(s => s.trim()) : [])].filter(Boolean);

    // project.md
    const projectMd = `# Project: ${name}

## Overview
${description || "[No description provided]"}

## Tech Stack
${fullStack.map(s => `- ${s}`).join("\n") || "- [Not specified]"}

## Framework
${detected.framework || "[Not detected]"}

## Infrastructure
- **Deploy**: ${deployTarget || "[Not specified]"}
- **Production URL**: ${prodUrl || "[Not specified]"}
- **TypeScript**: ${detected.hasTS ? "Yes" : "No"}
- **CSS**: ${detected.hasTailwind ? "TailwindCSS" : "[Not specified]"}
- **i18n**: ${detected.hasI18n ? "Yes" : "No"}
- **Auth**: ${detected.hasAuth ? "Yes" : "No"}
- **Database**: ${detected.hasDB ? "Yes" : "No"}

## Domain
- **Industry**: ${domain || "[Not specified]"}
- **User types**: ${userTypes || "[Not specified]"}

## Key Domain Terms
${keyTerms ? keyTerms.split(",").map(t => `- ${t.trim()}`).join("\n") : "[None specified]"}

## Business Rules
${businessRules ? businessRules.split(",").map(r => `- ${r.trim()}`).join("\n") : "[None specified]"}
`;

    // rules.md
    const rulesMd = `# Team Rules

These rules apply to ALL agents in the buildcrew team. Every agent MUST read and follow these rules before starting any work.

## Coding Conventions
${conventions ? conventions.split(",").map(c => `- ${c.trim()}`).join("\n") : "- [No specific conventions — follow existing codebase patterns]"}

## Priorities
${priorities ? priorities.split(",").map(p => `- ${p.trim()}`).join("\n") : "- [No specific priorities set]"}

## What to Avoid
${avoid ? avoid.split(",").map(a => `- ${a.trim()}`).join("\n") : "- [No specific avoidances]"}

## Quality Standards
${quality ? quality.split(",").map(q => `- ${q.trim()}`).join("\n") : "- All code must pass the project's type checker and linter\n- No debug logs in production code"}

## Review Standards
${reviewRules ? reviewRules.split(",").map(r => `- ${r.trim()}`).join("\n") : "- [No specific review rules — use agent defaults]"}

---

*Edit this file anytime to update team rules. All agents read it before every task.*
`;

    await writeFile(join(HARNESS_DIR, "project.md"), projectMd);
    await writeFile(join(HARNESS_DIR, "rules.md"), rulesMd);

    log(`\n  ${GREEN}${BOLD}Harness created!${RESET}\n`);
    log(`  ${GREEN} + ${RESET} .claude/harness/project.md  ${DIM}(project context)${RESET}`);
    log(`  ${GREEN} + ${RESET} .claude/harness/rules.md    ${DIM}(team rules)${RESET}`);
    log(`\n  ${DIM}Edit these files anytime — all agents read them before every task.${RESET}`);
    log(`  ${DIM}Run ${BOLD}npx buildcrew init --force${RESET}${DIM} to regenerate from scratch.${RESET}\n`);

    // Check if agents are installed
    if (!(await exists(TARGET_DIR))) {
      log(`  ${YELLOW}Agents not installed yet.${RESET} Run ${BOLD}npx buildcrew${RESET} to install.\n`);
    }

  } catch (err) {
    close();
    throw err;
  }
}

// ─── Install agents ───

async function runInstall(force) {
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));

  log(`\n  ${BOLD}buildcrew${RESET} v${VERSION}\n  ${DIM}11 AI agents for Claude Code${RESET}\n`);
  log(`${DIM}  Installing to ${TARGET_DIR}${RESET}\n`);

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

  // Check harness
  const hasHarness = await exists(join(HARNESS_DIR, "project.md"));
  if (!hasHarness) {
    log(`  ${CYAN}Recommended:${RESET} Run ${BOLD}npx buildcrew init${RESET} to set up your project harness.`);
    log(`  ${DIM}This tells agents about your project, team rules, and domain context.${RESET}\n`);
  }

  // Check Playwright MCP
  let hasPlaywright = false;
  try {
    const settingsPath = join(process.env.HOME, ".claude", "settings.json");
    if (await exists(settingsPath)) {
      hasPlaywright = (await readFile(settingsPath, "utf8")).includes("playwright");
    }
  } catch {}

  if (!hasPlaywright) {
    log(`  ${YELLOW}Optional:${RESET} Playwright MCP not detected.`);
    log(`  ${DIM}browser-qa and canary-monitor need it for real browser testing.${RESET}`);
    log(`  ${DIM}Setup: claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright${RESET}\n`);
  }

  log(`  ${BOLD}Quick start:${RESET}
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

// ─── List agents ───

async function runList() {
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));
  log(`\n  ${BOLD}buildcrew${RESET} v${VERSION} — 11 agents\n`);
  for (const file of files) {
    const content = await readFile(join(AGENTS_SRC, file), "utf8");
    const nameMatch = content.match(/^name:\s*(.+)$/m);
    const descMatch = content.match(/^description:\s*(.+)$/m);
    const modelMatch = content.match(/^model:\s*(.+)$/m);
    const name = nameMatch ? nameMatch[1] : file.replace(".md", "");
    const desc = descMatch ? descMatch[1] : "";
    const model = modelMatch ? modelMatch[1] : "sonnet";
    const isConstitution = name === "constitution";
    const modelTag = model === "opus" ? `${MAGENTA}opus${RESET}` : `${DIM}sonnet${RESET}`;
    const color = isConstitution ? BOLD : "";
    log(`  ${color}${name.padEnd(20)}${RESET} ${modelTag}  ${DIM}${desc.slice(0, 55)}${RESET}`);
  }
  log("");
}

// ─── Uninstall ───

async function runUninstall() {
  const files = (await readdir(AGENTS_SRC)).filter(f => f.endsWith(".md"));
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
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const force = args.includes("--force") || args.includes("-f");

  if (args.includes("--version") || args.includes("-v")) {
    log(`buildcrew v${VERSION}`);
    return;
  }

  if (args.includes("--help") || args.includes("-h")) {
    log(`
  ${BOLD}buildcrew${RESET} v${VERSION} — 11 AI agents for Claude Code

  ${BOLD}Commands:${RESET}
    npx buildcrew              Install agents to .claude/agents/
    npx buildcrew init         Set up project harness (context, rules, domain)
    npx buildcrew init --force Overwrite existing harness

  ${BOLD}Options:${RESET}
    --force, -f      Overwrite existing files
    --list, -l       List all agents
    --uninstall      Remove installed agents
    --version, -v    Show version
    --help, -h       Show this help

  ${BOLD}Setup (recommended order):${RESET}
    ${GREEN}1.${RESET} npx buildcrew          ${DIM}Install agent files${RESET}
    ${GREEN}2.${RESET} npx buildcrew init     ${DIM}Configure project harness${RESET}
    ${GREEN}3.${RESET} @constitution [task]   ${DIM}Start working${RESET}

  ${BOLD}Agents (11):${RESET}
    ${CYAN}Build${RESET}       planner ${DIM}(opus)${RESET}, designer, developer
    ${GREEN}Quality${RESET}     qa-tester, browser-qa, reviewer ${DIM}(opus)${RESET}, health-checker
    ${MAGENTA}Sec & Ops${RESET}   security-auditor ${DIM}(opus)${RESET}, canary-monitor, shipper
    ${YELLOW}Specialist${RESET}  investigator

  ${BOLD}9 Modes:${RESET}
    Feature, Project Audit, Browser QA, Security Audit,
    Debug, Health Check, Canary, Review, Ship

  ${BOLD}More info:${RESET} https://github.com/z1nun/buildcrew
`);
    return;
  }

  if (args.includes("--list") || args.includes("-l")) { return runList(); }
  if (args.includes("--uninstall")) { return runUninstall(); }
  if (command === "init") { return runInit(force); }

  // Default: install
  return runInstall(force);
}

main().catch(err => {
  console.error(`${RED}Error:${RESET} ${err.message}`);
  process.exit(1);
});
