#!/usr/bin/env node
/**
 * buildcrew dashboard demo — simulates a realistic pipeline with
 * conversational prompts so the Dialogue view reads like a team meeting.
 *
 * Usage:
 *   npx buildcrew-dashboard           # terminal 1
 *   node bin/dashboard-demo.js        # terminal 2
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
  await wait(600);

  // PLAN
  await emit({ type: "pipeline.stage", stage: "PLAN" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "planner", from: "buildcrew",
    prompt: "사용자 대시보드 기능 하나 부탁드려요. GitHub 로그인 붙여서, 하루 포커스 시간 리포트 보여주고, 팀 단위 leaderboard도 하나 있으면 좋겠어요. 요구사항 쪼개서 ACs까지 부탁드립니다.",
  });
  await wait(3500);
  await emit({ type: "file.written", agent: "planner", path: ".claude/pipeline/dashboard/01-plan.md" });
  await wait(400);
  await emit({
    type: "agent.completed", agent: "planner", duration_s: 4,
    output_summary: "스토리 3개로 쪼갰고요. GitHub 로그인 2개 ACs, 하루 포커스 리포트 5개 ACs, 팀 leaderboard 7개 ACs. 총 14개. 01-plan.md 올려뒀어요.",
  });
  await wait(900);

  // DESIGN
  await emit({ type: "pipeline.stage", stage: "DESIGN" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "designer", from: "buildcrew",
    prompt: "기획자 플랜 받으셨죠? 컴포넌트 스펙 좀 뽑아주세요. motion도 같이요. Playwright로 레퍼런스 몇 개 찾아서 녹여주시고.",
  });
  await wait(4200);
  await emit({ type: "file.written", agent: "designer", path: ".claude/pipeline/dashboard/02-design.md" });
  await wait(500);
  await emit({
    type: "agent.completed", agent: "designer", duration_s: 5,
    output_summary: "8개 컴포넌트 나왔습니다. Hero, StatCard, StreakChart, TeamRanking, ProfileHeader, Filters, EmptyState, ErrorState. Motion은 Linear 참고해서 Framer Motion 값 박아뒀어요.",
  });
  await wait(900);

  // DEV
  await emit({ type: "pipeline.stage", stage: "DEV" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "developer", from: "buildcrew",
    prompt: "디자이너 스펙 반영해서 구현 부탁드립니다. 스키마 + routes + pages 한꺼번에. Supabase RLS 잊지 말고요.",
  });
  await wait(2200);
  await emit({ type: "file.written", agent: "developer", path: "src/app/dashboard/page.tsx" });
  await wait(600);
  await emit({ type: "file.written", agent: "developer", path: "src/lib/stats/aggregate.ts" });
  await wait(600);
  await emit({ type: "file.written", agent: "developer", path: "supabase/migrations/20260414_stats.sql" });
  await wait(800);
  await emit({
    type: "agent.completed", agent: "developer", duration_s: 7,
    output_summary: "23 파일, 1,847 라인. 스키마 마이그레이션 올렸고 RLS 정책 3개 붙였어요. page.tsx에서 Server Component로 prefetch 하고 Client Component는 leaderboard만 간분리했어요.",
  });
  await wait(700);

  // QA (parallel)
  await emit({ type: "pipeline.stage", stage: "QA" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "qa-tester", from: "buildcrew",
    prompt: "QA 돌려주세요. 타입 체크, lint, build 3종 세트랑 단위 테스트까지.",
  });
  await emit({
    type: "agent.dispatched", agent: "browser-qa", from: "buildcrew",
    prompt: "브라우저 플로우 4단계 돌려주세요. 로그인 → 대시보드 진입 → leaderboard 확인 → 로그아웃.",
  });
  await wait(2800);
  await emit({
    type: "issue.found", agent: "qa-tester", severity: "med",
    title: "aggregate() 안에서 null 체크 빠짐",
    detail: "src/lib/stats/aggregate.ts:47 — userStats가 빈 배열일 때 reduce 초기값 없음. 실서비스에서 터질 수 있음.",
  });
  await wait(700);
  await emit({
    type: "agent.completed", agent: "qa-tester", duration_s: 3,
    output_summary: "타입/lint/build 통과. 단위 테스트 1개 failing (null 케이스). med 이슈 1개 리포트했어요.",
  });
  await wait(400);
  await emit({
    type: "agent.completed", agent: "browser-qa", duration_s: 3,
    output_summary: "헬스 87/100. 4개 플로우 다 통과. leaderboard 애니메이션이 살짝 버벅거리는데 허용 범위.",
  });
  await wait(800);

  // REVIEW
  await emit({ type: "pipeline.stage", stage: "REVIEW" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "reviewer", from: "buildcrew",
    prompt: "리뷰 부탁드려요. 보안/성능/테스트/유지보수 4개 관점으로요. critical 나오면 바로 멈춰주세요.",
  });
  await wait(3000);
  await emit({
    type: "issue.found", agent: "reviewer", severity: "critical",
    title: "SQL injection 가능 지점 하나 있음",
    detail: "stats.ts:47 에서 filter 파라미터가 raw string으로 쿼리에 박혀 들어감. Supabase 클라이언트 체이닝 쓰거나 파라미터라이즈 해야 합니다.",
  });
  await wait(600);
  await emit({
    type: "issue.found", agent: "reviewer", severity: "high",
    title: "/api/stats 에 rate limit 없음",
    detail: "대시보드 스팸 조회 막는 보호 필요. middleware에서 per-user 분당 60회 정도 권장.",
  });
  await wait(600);
  await emit({ type: "file.written", agent: "reviewer", path: ".claude/pipeline/dashboard/06-review.md" });
  await wait(600);
  await emit({
    type: "agent.completed", agent: "reviewer", duration_s: 4,
    output_summary: "critical 1, high 1, med 1 나왔습니다. SQL injection 건 바로 fix 부탁드려야 할 것 같고요. rate limit 건은 릴리즈 전에는 꼭 붙여야 합니다.",
  });
  await wait(900);

  // SHIP
  await emit({ type: "pipeline.stage", stage: "SHIP" });
  await wait(400);
  await emit({
    type: "agent.dispatched", agent: "shipper", from: "buildcrew",
    prompt: "프리플라이트 8종 돌리고 PR 만들어주세요. changelog도요.",
  });
  await wait(2500);
  await emit({
    type: "agent.completed", agent: "shipper", duration_s: 3,
    output_summary: "8종 체크 통과, version 1.9.0으로 올렸고 CHANGELOG.md 업데이트했습니다. PR #42 열었어요. Vercel preview도 도는 중이에요.",
  });
  await wait(500);

  await emit({ type: "session.end", session_id: sessionId, outcome: "success" });

  console.log("  demo complete.");
}

main().catch((err) => {
  console.error("  demo failed:", err.message);
  console.error("  is the dashboard running? `node bin/dashboard.js` first.");
  process.exit(1);
});
