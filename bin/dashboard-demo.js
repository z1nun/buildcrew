#!/usr/bin/env node
/**
 * buildcrew dashboard demo — simulates a realistic pipeline run.
 *
 * Usage: start the dashboard first, then run this in another terminal:
 *   npx buildcrew-dashboard           # terminal 1
 *   node bin/dashboard-demo.js        # terminal 2
 *
 * Emits a scripted sequence to POST /emit with timing so you can visually
 * verify the Phaser scenes without waiting for a real Claude Code session.
 */

const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3737", 10);
const BASE = `http://localhost:${PORT}`;

async function emit(event) {
  const res = await fetch(`${BASE}/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`emit failed: ${res.status}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`  buildcrew dashboard demo → ${BASE}`);
  console.log("  (open the browser to localhost:3737 before running)");
  console.log("");

  const sessionId = `demo-${Date.now()}`;

  await emit({ type: "session.start", session_id: sessionId, mode: "feature" });
  await wait(800);

  // PLAN stage
  await emit({ type: "pipeline.stage", stage: "PLAN" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "planner", from: "buildcrew", prompt: "Add user dashboard with realtime stats" });
  await wait(3500);
  await emit({ type: "file.written", agent: "planner", path: ".claude/pipeline/dashboard/01-plan.md" });
  await wait(600);
  await emit({ type: "agent.completed", agent: "planner", duration_s: 4, output_summary: "3 stories, 14 ACs" });
  await wait(900);

  // DESIGN stage
  await emit({ type: "pipeline.stage", stage: "DESIGN" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "designer", from: "buildcrew", prompt: "UI/UX + components" });
  await wait(4200);
  await emit({ type: "file.written", agent: "designer", path: ".claude/pipeline/dashboard/02-design.md" });
  await wait(500);
  await emit({ type: "agent.completed", agent: "designer", duration_s: 5, output_summary: "8 components" });
  await wait(900);

  // DEV stage
  await emit({ type: "pipeline.stage", stage: "DEV" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "developer", from: "buildcrew", prompt: "Implement schema, routes, pages" });
  await wait(2200);
  await emit({ type: "file.written", agent: "developer", path: "src/app/dashboard/page.tsx" });
  await wait(600);
  await emit({ type: "file.written", agent: "developer", path: "src/lib/stats/aggregate.ts" });
  await wait(600);
  await emit({ type: "file.written", agent: "developer", path: "supabase/migrations/20260414_stats.sql" });
  await wait(800);
  await emit({ type: "agent.completed", agent: "developer", duration_s: 7, output_summary: "23 files" });
  await wait(700);

  // QA stage (parallel qa-tester + browser-qa)
  await emit({ type: "pipeline.stage", stage: "QA" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "qa-tester", from: "buildcrew" });
  await emit({ type: "agent.dispatched", agent: "browser-qa", from: "buildcrew" });
  await wait(2800);
  await emit({ type: "issue.found", agent: "qa-tester", severity: "med", title: "Missing null check in aggregate()" });
  await wait(700);
  await emit({ type: "agent.completed", agent: "qa-tester", duration_s: 3, output_summary: "1 med issue" });
  await wait(400);
  await emit({ type: "agent.completed", agent: "browser-qa", duration_s: 3, output_summary: "Health 87/100" });
  await wait(800);

  // REVIEW stage
  await emit({ type: "pipeline.stage", stage: "REVIEW" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "reviewer", from: "buildcrew", prompt: "4-specialist analysis" });
  await wait(3000);
  await emit({ type: "issue.found", agent: "reviewer", severity: "critical", title: "SQL injection in filter param at stats.ts:47" });
  await wait(600);
  await emit({ type: "issue.found", agent: "reviewer", severity: "high", title: "Missing rate limit on /api/stats" });
  await wait(600);
  await emit({ type: "file.written", agent: "reviewer", path: ".claude/pipeline/dashboard/06-review.md" });
  await wait(600);
  await emit({ type: "agent.completed", agent: "reviewer", duration_s: 4, output_summary: "1 crit, 1 high, 1 med" });
  await wait(900);

  // SHIP stage
  await emit({ type: "pipeline.stage", stage: "SHIP" });
  await wait(400);
  await emit({ type: "agent.dispatched", agent: "shipper", from: "buildcrew", prompt: "Pre-flight + PR" });
  await wait(2500);
  await emit({ type: "agent.completed", agent: "shipper", duration_s: 3, output_summary: "PR #42 opened" });
  await wait(500);

  await emit({ type: "session.end", session_id: sessionId, outcome: "success" });

  console.log("  demo complete.");
}

main().catch((err) => {
  console.error("  demo failed:", err.message);
  console.error("  is the dashboard running? `node bin/dashboard.js` first.");
  process.exit(1);
});
