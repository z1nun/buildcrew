/**
 * lib/cli/init.js
 *
 * `npx buildcrew init` — zero-question harness generation. Detects the project
 * stack and writes .claude/harness/{project,rules}.md plus a curated set of
 * extra templates (architecture, erd, etc.) based on what was detected.
 *
 * Side-effects:
 *   - Backs up an existing harness to .claude/harness-backup/ when --force.
 *   - Asks an interactive question to install additional templates.
 */

import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ask, exists, getVersion, log,
  HARNESS_DIR, TEMPLATES_SRC,
  BOLD, CYAN, DIM, GREEN, RESET, YELLOW,
} from "./utils.js";
import { TEMPLATES, detectProject } from "./templates.js";

export async function runInit(force) {
  const VERSION = await getVersion();
  log(`\n  ${BOLD}buildcrew init${RESET} v${VERSION}\n`);

  const harnessExists = await exists(join(HARNESS_DIR, "project.md"));

  if (harnessExists && !force) {
    log(`  ${YELLOW}Harness already exists at .claude/harness/${RESET}`);
    log(`  ${DIM}Use ${BOLD}--force${RESET}${DIM} to regenerate. Or just edit the files directly.${RESET}\n`);
    return;
  }

  // Backup existing harness before overwriting — never silently destroy user edits.
  if (harnessExists && force) {
    const backupDir = join(process.cwd(), ".claude", "harness-backup");
    await mkdir(backupDir, { recursive: true });
    const harnessFiles = (await readdir(HARNESS_DIR)).filter(f => f.endsWith(".md"));
    for (const file of harnessFiles) {
      await copyFile(join(HARNESS_DIR, file), join(backupDir, file));
    }
    log(`  ${CYAN}Backed up ${harnessFiles.length} harness files → .claude/harness-backup/${RESET}\n`);
  }

  log(`  ${DIM}Scanning project...${RESET}\n`);
  const d = await detectProject();

  await mkdir(HARNESS_DIR, { recursive: true });

  // Generate project.md and rules.md from detected info.
  await writeFile(join(HARNESS_DIR, "project.md"), buildProjectMd(d));
  await writeFile(join(HARNESS_DIR, "rules.md"), buildRulesMd(d));

  // Auto-add stack-relevant templates. Order matters for the printed list.
  const autoTemplates = [];
  if (d.hasDB) autoTemplates.push("erd");
  if (d.apiRoutes.length > 0) autoTemplates.push("api-spec");
  if (d.hasTailwind) autoTemplates.push("design-system");
  if (d.hasI18n || d.components.length > 5) autoTemplates.push("user-flow");
  autoTemplates.push("architecture");

  let templateCount = 0;
  for (const name of autoTemplates) {
    const t = TEMPLATES[name];
    if (t && t.file) {
      await copyFile(join(TEMPLATES_SRC, t.file), join(HARNESS_DIR, `${name}.md`));
      templateCount++;
    }
  }

  // Print results
  log(`  ${GREEN}${BOLD}Harness generated!${RESET} (${2 + templateCount} files)\n`);
  log(`  ${GREEN} + ${RESET} project.md       ${DIM}auto-detected from package.json${RESET}`);
  log(`  ${GREEN} + ${RESET} rules.md         ${DIM}smart defaults for ${d.framework || "your stack"}${RESET}`);
  for (const name of autoTemplates) {
    log(`  ${GREEN} + ${RESET} ${(name + ".md").padEnd(17)}${DIM}${TEMPLATES[name].desc}${RESET}`);
  }

  // Show what was detected
  log(`\n  ${BOLD}Detected:${RESET}`);
  if (d.stack.length > 0) log(`  ${CYAN}Stack${RESET}       ${d.stack.join(", ")}`);
  if (d.deploy) log(`  ${CYAN}Deploy${RESET}      ${d.deploy}`);
  if (d.components.length > 0) log(`  ${CYAN}Components${RESET}  ${d.components.length} found`);
  if (d.apiRoutes.length > 0) log(`  ${CYAN}API Routes${RESET}  ${d.apiRoutes.length} found`);
  if (d.locales.length > 0) log(`  ${CYAN}Locales${RESET}     ${d.locales.join(", ")}`);

  // Interactive: offer remaining templates
  const remaining = Object.entries(TEMPLATES).filter(([name, t]) => t.file && !autoTemplates.includes(name));
  if (remaining.length > 0) {
    log(`\n  ${BOLD}Additional harness files available:${RESET}\n`);
    for (let i = 0; i < remaining.length; i++) {
      const [name, t] = remaining[i];
      log(`    ${BOLD}${i + 1})${RESET} ${CYAN}${name}${RESET} — ${DIM}${t.desc}${RESET}`);
    }
    log(`    ${BOLD}A)${RESET} All of the above`);
    log(`    ${BOLD}S)${RESET} Skip\n`);

    const answer = await ask(`  Which ones? ${DIM}(numbers separated by space, A for all, S to skip)${RESET} `);

    if (answer === "a" || answer === "all") {
      for (const [name, t] of remaining) {
        await copyFile(join(TEMPLATES_SRC, t.file), join(HARNESS_DIR, `${name}.md`));
        log(`  ${GREEN} + ${RESET} ${name}.md`);
      }
      log("");
    } else if (answer && answer !== "s" && answer !== "skip") {
      const nums = answer.split(/[\s,]+/).map(n => parseInt(n) - 1).filter(n => n >= 0 && n < remaining.length);
      for (const idx of nums) {
        const [name, t] = remaining[idx];
        await copyFile(join(TEMPLATES_SRC, t.file), join(HARNESS_DIR, `${name}.md`));
        log(`  ${GREEN} + ${RESET} ${name}.md`);
      }
      if (nums.length > 0) log("");
    }
  }

  log(`  ${BOLD}Next step:${RESET} Edit ${CYAN}.claude/harness/*.md${RESET} — fill in project-specific details.`);
  log(`  ${DIM}Look for <!-- comments --> — those are the parts to customize.${RESET}\n`);
}

// ─── Markdown templates ───
// Exported so tests can verify the generated content without running runInit.

export function buildProjectMd(d) {
  return `# Project: ${d.name || "my-project"}

## Overview
${d.description || "<!-- Describe what this project does in 1-2 sentences -->"}

## Tech Stack
${d.stack.map(s => `- ${s}`).join("\n") || "<!-- Add your tech stack -->"}

## Framework
${d.framework || "<!-- Not detected -->"}

## Infrastructure
- **Deploy**: ${d.deploy || "<!-- Vercel / AWS / Netlify / etc. -->"}
- **Production URL**: <!-- https://your-app.com -->
- **TypeScript**: ${d.hasTS ? "Yes" : "No"}
- **CSS**: ${d.hasTailwind ? "TailwindCSS" : "<!-- Your CSS solution -->"}
- **i18n**: ${d.hasI18n ? `Yes (${d.locales.join(", ")})` : "No"}
- **Auth**: ${d.hasAuth ? d.authName : "No"}
- **Database**: ${d.hasDB ? d.dbName : "No"}
- **Payments**: ${d.hasPayments ? d.paymentName : "No"}
- **AI**: ${d.hasAI ? d.stack.find(s => ["OpenAI","Anthropic","Google AI"].includes(s)) || "Yes" : "No"}

## Key Components
${d.components.length > 0 ? d.components.map(c => `- ${c}`).join("\n") : "<!-- List your main components -->"}

## API Routes
${d.apiRoutes.length > 0 ? d.apiRoutes.map(r => `- \`/api${r}\``).join("\n") : "<!-- List your API endpoints -->"}

## Domain
- **Industry**: <!-- e.g., e-commerce, fintech, entertainment -->
- **User types**: <!-- e.g., free users, premium users, admins -->

## Key Domain Terms
<!-- Define project-specific terms so agents use consistent language -->
<!-- - term = definition -->

## Business Rules
<!-- Rules that affect feature development -->
<!-- - Free users: 3 actions per day -->
<!-- - Premium: unlimited access -->
`;
}

export function buildRulesMd(d) {
  return `# Team Rules

All agents read this before every task. Edit freely.

## Coding Conventions
${d.framework === "Next.js" ? `- Use App Router patterns
- Server components by default, "use client" only when needed
- Functional components only` : "<!-- Add your coding conventions -->"}
${d.hasTS ? "- Strict TypeScript — no \`any\` types" : ""}
${d.hasTailwind ? "- Use TailwindCSS utility classes, avoid custom CSS" : ""}
- No \`console.log\` in production code
- No default exports (except pages/layouts)

## Priorities
- UX over premature optimization
- Mobile-first responsive design
${d.hasI18n ? `- i18n: all user-facing text must be in locale files (${d.locales.join(", ")})` : ""}
${d.hasPayments ? "- Payment security: amounts validated server-side only" : ""}

## What to Avoid
- Class components
- \`any\` type assertions
- Inline styles (use Tailwind or CSS modules)
- Hardcoded strings in UI (use i18n)
- Direct DB access from client components

## Quality Standards
${d.hasTS ? "- \`npx tsc --noEmit\` must pass" : ""}
- \`npm run lint\` must pass
- \`npm run build\` must pass
${d.hasI18n && d.locales.length > 0 ? `- All ${d.locales.length} locale files must be in sync` : ""}
- No unused imports or variables

## Review Standards
${d.hasAuth ? "- All API routes must check authentication" : ""}
${d.hasPayments ? "- Payment mutations must be server-side and atomic" : ""}
${d.hasAI ? "- AI-generated content treated as untrusted (sanitize before render)" : ""}
- Check for XSS on any user input rendering
- Verify responsive layout at 375px, 768px, 1440px
`;
}
