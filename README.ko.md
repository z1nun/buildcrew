# buildcrew

> [English](README.md) | **한국어** | [문서](https://buildcrew-landing.vercel.app)

Claude Code를 위한 17개 AI 에이전트 팀. 생각부터 배포까지 전체 개발 라이프사이클을 자동으로 진행합니다.

```bash
npx buildcrew
```

---

## 왜 buildcrew인가?

AI 코딩 에이전트가 아무리 똑똑해도, 구조 없이 쓰면 결과가 들쑥날쑥합니다. buildcrew는 Claude Code에 **팀**, **프로세스**, **컨텍스트**를 제공합니다.

- **팀** — 역할이 명확한 17개 전문 에이전트 (9 opus + 8 sonnet)
- **프로세스** — 품질 게이트가 있는 순차 파이프라인. 통과 못하면 자동으로 재시도
- **하네스** — 코드베이스를 분석해서 프로젝트 맥락을 자동으로 파악
- **오케스트레이터** — `@buildcrew`에게 말하면 알아서 적절한 에이전트를 투입
- **세컨드 오피니언** — 모든 작업 후 독립적인 리뷰 (Codex 또는 Claude subagent)

```
나:     @buildcrew 유저 인증 추가해줘
크루:   기획자 → 디자이너 → 개발자 → QA → 브라우저 QA → 리뷰어 → 배포
```

외부 의존성 없음. 런타임 없음. 바이너리 없음. 마크다운 파일만으로 동작합니다.

---

## 시작하기

한 명령어로 전부 끝납니다:

```bash
npx buildcrew
```

인터랙티브 셋업이 순서대로 진행합니다:
1. 17개 에이전트 + 오케스트레이터 설치
2. Playwright MCP 설치 여부 (브라우저 테스트에 필요)
3. 프로젝트 하네스 생성 여부 (스택 자동 감지)
4. 추가 하네스 템플릿 선택

그 다음 바로 사용:

```bash
@buildcrew 유저 대시보드 추가해줘
```

---

## 에이전트

### 빌드 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **planner** | opus | 6가지 강제 질문으로 요구사항 분석. 4관점 자체 리뷰 (CEO, 엔지니어링, 디자인, QA). 관점별 1-10점 채점. |
| **designer** | opus | UI/UX 레퍼런스 리서치 + 모션 엔지니어링. Playwright 스크린샷, Figma MCP, 프로덕션 컴포넌트 생성. |
| **developer** | opus | 6가지 구현 질문으로 코드베이스 파악 후 구현. 3관점 자체 리뷰 (아키텍처, 품질, 안전성). 에러 핸들링 프로토콜 내장. |

### 적대적 팀 (Challenger)

파이프라인 각 단계 사이에 끼어들어 상위 산출물을 공격합니다. 하위 에이전트가 작업을 시작하기 전에 기획/설계의 오류를 잡아내는 "두 번째 의견" 역할. APPROVED / REVISE / REJECT 판정을 내리고 REVISE는 상위 에이전트 재실행(최대 2회)을 트리거합니다.

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **plan-challenger** | opus | `01-plan.md`를 6가지 벡터로 공격 (전제, 스코프, 대안, 리스크, 인수 기준, 성공 지표). planner 후, designer 전 실행. `01.5-plan-critique.md` 출력. |
| **spec-challenger** | opus | `02-design.md` **문서**를 8가지 벡터로 공격 (플랜 정합성, 상태 커버리지, 엣지 케이스, 데이터 흐름, 실패 모드, 접근성, 모션 스펙, 개발자 계약). 렌더된 UI는 아님 — 그건 `design-reviewer`가 담당. designer 후, developer 전 실행. `02.5-spec-critique.md` 출력. |

### 품질 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **qa-tester** | sonnet | 5가지 테스트 전략 질문 + 테스트 맵. 엣지 케이스 자동 생성, 신뢰도 점수 기반 분류. |
| **browser-qa** | sonnet | 4단계 브라우저 테스트 (파악→탐색→스트레스→판단). Playwright MCP. 건강 점수 0-100. |
| **reviewer** | opus | 4전문가 심층 리뷰 (보안, 성능, 테스트, 유지보수) + 적대적 리뷰 + 자동 수정. 코드 작성 후 실행. |
| **health-checker** | sonnet | 3단계 코드 품질 (감지→측정→처방). 가중 점수 0-10 + 트렌드 + 조치 항목 5개. |

### 보안 & 운영 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **security-auditor** | sonnet | OWASP Top 10 + STRIDE 위협 모델. 10단계 보안 감사. |
| **canary-monitor** | sonnet | 3단계 배포 후 모니터링 (파악→검증→판단). 베이스라인 비교, 신뢰도 점수. |
| **shipper** | sonnet | 8가지 사전 점검 → 버전 → 체인지로그 → PR → 배포 후 검증. |

### 생각 & 리뷰 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **thinker** | opus | "이거 만들 가치가 있나?" — 6가지 핵심 질문, 전제 의문, 대안 3개, 외부 관점 수집, 설계 문서 생성. |
| **architect** | opus | 코드 짜기 전 아키텍처 리뷰 — 스코프 챌린지, 컴포넌트 다이어그램, 데이터 흐름, 실패 모드, 테스트 커버리지 맵. |
| **design-reviewer** | sonnet | UI/UX 품질 — 8차원 0-10점 평가, Playwright 스크린샷 기반, 구체적 수정안 + 노력도, WCAG 준수. |

### 전문가

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **investigator** | sonnet | 4단계 근본 원인 디버깅. 12가지 대표 버그 패턴. 무관한 코드 수정 자동 차단. |
| **qa-auditor** | opus | 3개 병렬 subagent (보안, 버그, 설계 준수)가 git diff를 설계 문서와 비교 검사. API 키 불필요. |

---

## 13가지 운영 모드

`@buildcrew`에게 자연스럽게 말하면 됩니다. 모드는 자동으로 감지됩니다.

| 모드 | 예시 | 파이프라인 |
|------|------|----------|
| **Feature** | "유저 대시보드 추가해줘" | 기획 → plan-challenger → 디자인 → spec-challenger → 개발 → QA → 브라우저 QA → 리뷰 → coherence 감사 |
| **Project Audit** | "프로젝트 전체 점검해줘" | 스캔 → 우선순위 → 수정 → 검증 (반복) |
| **Browser QA** | "브라우저 테스트해줘" | Playwright 테스트 + 건강 점수 |
| **Security** | "보안 점검해줘" | OWASP + STRIDE + 시크릿 + 의존성 |
| **Debug** | "왜 로그인이 안 돼?" | 4단계 근본 원인 조사 |
| **Health** | "헬스체크 돌려줘" | 품질 대시보드 |
| **Canary** | "배포 확인해줘" | 프로덕션 모니터링 |
| **Review** | "코드 리뷰해줘" | 4전문가 병렬 리뷰 + 자동 수정 |
| **Ship** | "배포해줘" | 사전 점검 → 버전 → 체인지로그 → PR |
| **QA Audit** | "코드 검사해줘" | 3 subagent 병렬 검사 |
| **Think** | "이거 만들 가치가 있을까?" | 6가지 질문 + 대안 + 설계 문서 |
| **Arch Review** | "아키텍처 리뷰해줘" | 스코프 + 다이어그램 + 실패 모드 |
| **Design Review** | "디자인 리뷰해줘" | 8차원 점수 + 구체적 수정안 |

### 모드 우선순위

메시지가 여러 모드에 해당하면 우선순위 테이블로 해결합니다. Debug가 항상 최우선. Think은 Feature보다 우선. 애매하면 사용자에게 물어봅니다.

### 세컨드 오피니언

모든 모드 완료 후 독립적인 리뷰를 제안합니다:
- **Codex CLI 있으면**: 다른 AI 모델이 독립 리뷰
- **없으면**: 세션 기억 없는 새 Claude subagent가 리뷰

사용자가 결과를 보고 어떤 걸 반영할지 결정합니다.

### 반복 실행

매 반복마다 전체 파이프라인을 처음부터 다시 돌립니다:

```
@buildcrew 유저 대시보드 추가해줘, 5 iterations
```

---

## 하네스 엔지니어링

`npx buildcrew` 실행 시 코드베이스를 스캔해서 프로젝트 하네스를 자동 생성합니다.

### 자동 감지 항목

| 카테고리 | 감지 대상 |
|---------|----------|
| 프레임워크 | Next.js, Nuxt, React, Vue, SvelteKit, Express |
| 언어/CSS | TypeScript, TailwindCSS, Framer Motion |
| 데이터베이스 | Supabase, Prisma, Drizzle, MongoDB |
| 인증 | NextAuth, Supabase Auth, Firebase Auth |
| 결제 | Stripe, Paddle, Toss Payments |
| AI | OpenAI, Anthropic, Google AI |
| 배포 | Vercel, Netlify, Fly.io, Docker |

### 생성되는 파일

```
.claude/harness/
├── project.md        ← 항상 (프로젝트 컨텍스트, 스택, 컴포넌트, API)
├── rules.md          ← 항상 (프레임워크에 맞는 코딩 규칙)
├── erd.md            ← DB 감지 시
├── api-spec.md       ← API 라우트 발견 시
├── design-system.md  ← TailwindCSS 감지 시
├── architecture.md   ← 항상
└── user-flow.md      ← i18n 또는 5개 이상 컴포넌트 시
```

### 열린 구조

`.claude/harness/`에 아무 `.md` 파일이나 추가하면 에이전트가 읽습니다.

```bash
npx buildcrew harness     # 어떤 파일을 편집해야 하는지 확인
npx buildcrew add         # 사용 가능한 템플릿 목록
```

---

## 기능 파이프라인

기능마다 전체 문서 체인이 자동 생성됩니다:

```
.claude/pipeline/{기능명}/
├── 01-plan.md           요구사항 + 4관점 리뷰 점수
├── 02-design.md         디자인 결정 + 컴포넌트 스펙
├── 03-dev-notes.md      구현 + 6질문 분석 + 자체 리뷰
├── 04-qa-report.md      테스트 맵 + 수용 기준 검증
├── 05-browser-qa.md     건강 점수 + 스크린샷
├── 06-review.md         4전문가 발견 + 자동 수정
└── 07-ship.md           PR URL + 릴리즈 노트
```

---

## CLI

| 명령어 | 설명 |
|--------|------|
| `npx buildcrew` | 전체 인터랙티브 셋업 (에이전트 + MCP + 하네스) |
| `npx buildcrew init` | 하네스만 생성 |
| `npx buildcrew init --force` | 하네스 재생성 (기존 백업) |
| `npx buildcrew add` | 사용 가능한 템플릿 목록 |
| `npx buildcrew add <name>` | 템플릿 추가 |
| `npx buildcrew harness` | 하네스 파일 상태 확인 |
| `npx buildcrew --force` | 에이전트 덮어쓰기 |
| `npx buildcrew --list` | 에이전트 목록 + 모델 정보 |
| `npx buildcrew --uninstall` | 에이전트 제거 |
| `npx buildcrew --version` | 버전 확인 |

## 요구사항

- **필수**: [Claude Code](https://claude.ai/code) CLI
- **필수**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — 셋업 중 자동 설치
- **선택**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — designer가 사용
- **선택**: [Codex CLI](https://github.com/openai/codex) — 크로스 모델 세컨드 오피니언

## 아키텍처

```
@buildcrew (오케스트레이터, opus, 199줄)
    │
    ├─ .claude/harness/*.md 읽기
    ├─ 유저 메시지에서 모드 자동 감지 (13개 모드, 우선순위 테이블)
    ├─ 하네스 컨텍스트와 함께 에이전트 디스패치
    ├─ 품질 게이트 + 반복 관리
    └─ 완료 후 세컨드 오피니언 제안
         │
         ├── 생각:     thinker → architect
         ├── 빌드:     planner → designer → developer
         ├── 품질:     qa-tester → browser-qa → reviewer
         ├── 보안/운영: security-auditor, canary-monitor, shipper
         ├── 리뷰:     architect, design-reviewer, qa-auditor
         └── 디버그:   investigator
```

### 버전 자동 업데이트

에이전트에 버전 헤더가 포함되어 있습니다. 기존 프로젝트에서 `npx buildcrew`를 다시 실행하면 구버전 에이전트가 자동으로 업데이트됩니다.

## 라이선스

MIT
