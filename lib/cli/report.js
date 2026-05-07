/**
 * lib/cli/report.js
 *
 * `npx buildcrew report` — surface the latest coherence-report.md produced by
 * the coherence-auditor agent at the end of a Feature run.
 *
 * Modes:
 *   npx buildcrew report                  Show latest report (paged via less)
 *   npx buildcrew report --list           List all reports with timestamps
 *   npx buildcrew report <feature>        Show a specific feature's report
 *   npx buildcrew report --raw            Print raw markdown (pipe-friendly)
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  exists, log,
  BOLD, CYAN, DIM, RED, RESET, YELLOW,
} from "./utils.js";

export async function runReport() {
  const args = process.argv.slice(3);
  const wantList = args.includes("--list") || args.includes("-l");
  const wantRaw = args.includes("--raw");
  const featureArg = args.find(a => !a.startsWith("-"));

  const PIPELINE_DIR = join(process.cwd(), ".claude", "pipeline");
  if (!(await exists(PIPELINE_DIR))) {
    log(`${YELLOW}No pipeline runs found yet.${RESET}`);
    log(`${DIM}Run ${BOLD}@buildcrew <feature>${RESET}${DIM} in Claude Code to generate one.${RESET}\n`);
    return;
  }

  // Collect all coherence-report.md files with their mtimes for sorting.
  const features = await readdir(PIPELINE_DIR, { withFileTypes: true });
  const reports = [];
  for (const entry of features) {
    if (!entry.isDirectory()) continue;
    const reportPath = join(PIPELINE_DIR, entry.name, "coherence-report.md");
    if (await exists(reportPath)) {
      const s = await stat(reportPath);
      reports.push({ feature: entry.name, path: reportPath, mtime: s.mtime });
    }
  }

  if (reports.length === 0) {
    log(`${YELLOW}No coherence-report.md found in any pipeline run.${RESET}`);
    log(`${DIM}coherence-auditor runs at the end of Feature mode. If you ran a feature recently and don't see a report, check your buildcrew version (need >= 1.9.0).${RESET}\n`);
    return;
  }

  reports.sort((a, b) => b.mtime - a.mtime);

  if (wantList) {
    log(`\n  ${BOLD}Coherence reports${RESET} ${DIM}(newest first)${RESET}\n`);
    for (const r of reports) {
      const ago = ((Date.now() - r.mtime) / 1000 / 60) | 0;
      const when = ago < 60
        ? `${ago}m ago`
        : ago < 1440
          ? `${(ago / 60) | 0}h ago`
          : `${(ago / 1440) | 0}d ago`;
      log(`  ${CYAN}${r.feature.padEnd(30)}${RESET} ${DIM}${when.padStart(8)}${RESET}  ${DIM}${r.path}${RESET}`);
    }
    log(`\n  ${DIM}Show one: ${BOLD}npx buildcrew report ${CYAN}<feature>${RESET}\n`);
    return;
  }

  // Pick target report — explicit feature wins over "latest by mtime".
  let target;
  if (featureArg) {
    target = reports.find(r => r.feature === featureArg);
    if (!target) {
      log(`${RED}No coherence-report for feature "${featureArg}".${RESET}`);
      log(`${DIM}List all: ${BOLD}npx buildcrew report --list${RESET}\n`);
      process.exit(1);
    }
  } else {
    target = reports[0]; // latest
  }

  const content = await readFile(target.path, "utf8");

  if (wantRaw) {
    process.stdout.write(content);
    return;
  }

  // Pretty header + content. If TTY supports it, page through `less -R`
  // (preserves ANSI). Falls back to direct stdout on any error.
  const header = `${BOLD}${CYAN}═══ ${target.feature} ═══${RESET}  ${DIM}${target.path}${RESET}\n\n`;

  if (process.stdout.isTTY && content.split("\n").length > process.stdout.rows) {
    try {
      const { spawn } = await import("node:child_process");
      const less = spawn("less", ["-R", "-X"], { stdio: ["pipe", "inherit", "inherit"] });
      less.stdin.write(header + content);
      less.stdin.end();
      await new Promise((resolve) => less.on("exit", resolve));
      return;
    } catch {
      // fall through to direct print
    }
  }

  process.stdout.write(header + content + "\n");
}
