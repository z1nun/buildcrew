/**
 * Agent voice / personality templates.
 * Wraps raw prompts and outputs in a character voice so the Dialogue
 * view reads like a team meeting, not a system log.
 */

// Emoji per agent (mirrors TownScene's AGENTS list)
export const AGENT_EMOJI = {
  buildcrew:        "🎩",
  planner:          "📋",
  designer:         "🎨",
  developer:        "💻",
  "qa-tester":      "🧪",
  "browser-qa":     "🌐",
  reviewer:         "🧐",
  "health-checker": "🩺",
  "security-auditor": "🛡️",
  "canary-monitor": "🐤",
  shipper:          "🚢",
  thinker:          "🤔",
  architect:        "📐",
  "design-reviewer": "👀",
  investigator:     "🕵️",
  "qa-auditor":     "⚖️",
};

// Role titles (Korean) — used for "X님" style addressing
const TITLES = {
  buildcrew:        "팀장",
  planner:          "기획자",
  designer:         "디자이너",
  developer:        "개발자",
  "qa-tester":      "QA",
  "browser-qa":     "브라우저 QA",
  reviewer:         "리뷰어",
  "health-checker": "품질 지표",
  "security-auditor": "보안 감사",
  "canary-monitor": "카나리",
  shipper:          "출고",
  thinker:          "생각꾼",
  architect:        "아키텍트",
  "design-reviewer": "디자인 리뷰어",
  investigator:     "조사관",
  "qa-auditor":     "QA 감사",
};

// Agents speak differently. Opener / inflection per role.
const OPENERS = {
  planner:          ["네,", "정리하면,", "플랜 잡아봤어요.", "이렇게 해봅시다."],
  designer:         ["이런 느낌 어때요?", "디자인 나왔습니다.", "스펙 뽑았어요."],
  developer:        ["오케이,", "구현했어요.", "갑니다.", "짜봤어요."],
  "qa-tester":      ["테스트 결과 보고드려요.", "돌려봤어요.", "확인했습니다."],
  "browser-qa":     ["브라우저 QA 결과요.", "플로우 태워봤어요.", "UX 확인했어요."],
  reviewer:         ["잠깐, 여기 좀 봐주세요.", "리뷰 결과 나왔어요.", "이거 짚고 넘어가야 할 듯요.", "확인했습니다."],
  "health-checker": ["품질 스코어 정리했어요.", "헬스체크 결과요.", "지표 뽑았습니다."],
  "security-auditor": ["보안 감사 결과요.", "취약점 확인했어요.", "OWASP 기준으로 봤을 때,"],
  "canary-monitor": ["운영 상태 보고요.", "프로덕션 지켜보고 있어요.", "카나리 리포트."],
  shipper:          ["출항 준비 완료.", "프리플라이트 체크요.", "릴리즈 올렸습니다."],
  thinker:          ["이게 정말 필요한가요?", "근본부터 보면,", "생각해봤는데요."],
  architect:        ["아키텍처 측면에서,", "구조 검토했어요.", "설계 관점에서 보면,"],
  "design-reviewer": ["UX 관점에서 보면,", "디자인 리뷰 결과요.", "포인트 좀 짚어볼게요."],
  investigator:     ["원인 찾았어요.", "조사 결과요.", "들여다봤는데,"],
  "qa-auditor":     ["감사 결과 나왔어요.", "3개 관점으로 봤을 때,"],
  buildcrew:        ["팀,", "자,", "그럼,", "좋아요,"],
};

/**
 * Render a dispatch line: buildcrew → agent
 * @param {string} agentId target
 * @param {string} prompt raw prompt text
 */
export function dispatchLine(agentId, prompt) {
  const title = TITLES[agentId] ?? agentId;
  const opener = pickOpener("buildcrew");
  const cleaned = (prompt ?? "").trim();
  if (!cleaned) return `${opener} ${title}님, 잠깐 도와주실래요?`;
  return `${opener} ${title}님, ${cleaned}`;
}

/**
 * Render a completion line: agent → buildcrew
 * @param {string} agentId source
 * @param {string} output raw output_summary
 */
export function completeLine(agentId, output) {
  const opener = pickOpener(agentId);
  const cleaned = (output ?? "").trim();
  if (!cleaned) return `${opener} 마쳤습니다.`;
  return `${opener} ${cleaned}`;
}

/**
 * Render an issue as in-character raise:
 * reviewer/qa/security → raises concern toward the responsible agent
 */
export function issueLine(agentId, severity, title) {
  const opener = pickOpener(agentId);
  const tag = ({
    critical: "❗ 치명적 이슈", high: "⚠ 주요 이슈",
    med: "중간 이슈", low: "가벼운 이슈",
  })[severity] ?? "이슈";
  return `${opener} ${tag} · ${title}`;
}

/**
 * Stage narration from the team lead.
 */
export function stageLine(stage) {
  const s = (stage ?? "").toUpperCase();
  const phrases = {
    PLAN:    "기획 들어갑시다. 기획자님 부탁해요.",
    DESIGN:  "디자인 들어갑시다. 디자이너님 이어받아요.",
    DEV:     "구현 단계요. 개발자님, 갑시다.",
    QA:      "QA 단계요. 테스트 돌려봐요.",
    REVIEW:  "리뷰 단계. 놓친 부분 없나 짚어봅시다.",
    SHIP:    "출고 준비요. 프리플라이트 갑시다.",
  };
  return phrases[s] ?? `다음 단계: ${s}`;
}

function pickOpener(agentId) {
  const opts = OPENERS[agentId] ?? [""];
  return opts[Math.floor(Math.random() * opts.length)];
}

/**
 * Get emoji for an agent (falls back to generic).
 */
export function agentEmoji(agentId) {
  return AGENT_EMOJI[agentId] ?? "•";
}
