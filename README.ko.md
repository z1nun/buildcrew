# buildcrew

> [English](README.md) | **한국어** | [문서](https://buildcrew-landing.vercel.app)

Claude Code를 위한 12개 AI 에이전트 팀. 명령 하나로 기획부터 배포까지 자동으로 진행됩니다.

```bash
npx buildcrew
```

---

## 왜 buildcrew인가?

AI 코딩 에이전트가 아무리 똑똑해도, 구조 없이 쓰면 결과가 들쑥날쑥합니다. buildcrew는 Claude Code에 **팀**, **프로세스**, **컨텍스트**를 제공합니다.

- **팀** — 역할이 명확한 12개 전문 에이전트 (6 opus + 6 sonnet)
- **프로세스** — 품질 게이트가 있는 순차 파이프라인. 통과 못하면 자동으로 재시도
- **하네스** — 코드베이스를 분석해서 프로젝트 맥락을 자동으로 파악
- **오케스트레이터** — `@buildcrew`에게 말하면 알아서 적절한 에이전트를 투입

```
나:     @buildcrew 유저 인증 추가해줘
크루:   기획자 → 디자이너 → 개발자 → QA → 브라우저 QA → 리뷰어 → 배포
```

외부 의존성 없음. 런타임 없음. 바이너리 없음. 마크다운 파일만으로 동작합니다.

---

## 시작하기

```bash
# 1. 에이전트 설치
npx buildcrew

# 2. 프로젝트 하네스 자동 생성 (질문 없이 코드베이스 분석)
npx buildcrew init

# 3. 필요한 부분만 커스터마이징
code .claude/harness/

# 4. 바로 사용
@buildcrew 유저 대시보드 추가해줘
```

---

## 하네스 엔지니어링

`npx buildcrew init` 하나로 코드베이스를 스캔해서 프로젝트 하네스를 자동 생성합니다. 질문하지 않습니다.

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
| 컴포넌트 | `src/components/` 자동 스캔 |
| API 라우트 | `src/app/api/` 자동 스캔 |
| 다국어 | i18n 디렉토리 스캔 |

### 생성되는 파일

감지 결과에 따라 필요한 하네스 파일이 자동으로 생성됩니다:

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

### 커스터마이징

생성된 파일에서 `<!-- HTML 주석 -->`으로 된 부분만 채우면 됩니다. 나머지는 코드베이스에서 이미 채워져 있습니다.

```bash
npx buildcrew harness     # 어떤 파일을 편집해야 하는지 확인
```

### 열린 구조

`.claude/harness/`에 아무 `.md` 파일이나 추가하면 에이전트가 읽습니다:

```bash
npx buildcrew add glossary    # 용어 사전 추가
npx buildcrew add env-vars    # 환경 변수 가이드 추가
echo "# 내 메모" > .claude/harness/notes.md  # 직접 파일 생성도 가능
```

### 에이전트 라우팅

각 에이전트는 자기 역할에 맞는 하네스 파일만 읽습니다:

| 파일 | 읽는 에이전트 |
|------|-------------|
| `project.md`, `rules.md` | 모든 에이전트 |
| `erd.md`, `architecture.md`, `api-spec.md` | developer, reviewer, security-auditor, investigator |
| `design-system.md` | designer |
| `glossary.md`, `user-flow.md` | planner, designer, browser-qa |
| `env-vars.md` | developer, security-auditor |
| 커스텀 `.md` 파일 | reviewer, security-auditor (전부 읽음) |

---

## 에이전트

### 빌드 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **planner** | opus | 6가지 강제 질문으로 요구사항 분석 → 4관점 자체 리뷰 (CEO, 엔지니어링, 디자인, QA). 관점별 1-10점 채점 후 기준 미달 시 자동 보강. |
| **designer** | opus | UI/UX 레퍼런스 리서치 + 모션 엔지니어링. Playwright로 실제 사이트 스크린샷 수집, Figma MCP 연동, 애니메이션과 인터랙션이 포함된 프로덕션 컴포넌트 생성. AI 슬롭 블랙리스트 적용. |
| **developer** | sonnet | 6가지 구현 질문으로 코드베이스를 먼저 파악한 뒤 구현. 3관점 자체 리뷰 (아키텍처, 코드 품질, 안전성)로 자기 코드 검증. 에러 핸들링 프로토콜 내장. 기능 구현, 버그 수정, 반복 수정 3가지 모드 지원. |

### 품질 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **qa-tester** | sonnet | 5가지 테스트 전략 질문으로 체계적 검증. 테스트 맵을 먼저 만들고 수용 기준별 검증 수행. 엣지 케이스 자동 생성, 신뢰도 점수 기반 버그 분류. |
| **browser-qa** | sonnet | Playwright MCP로 실제 브라우저 테스트. 유저 플로우, 반응형, 콘솔 에러 확인. 건강 점수 (0-100) 산출. |
| **reviewer** | opus | 4명의 전문가 관점으로 심층 리뷰 (보안, 성능, 테스트, 유지보수). 신뢰도 점수 + 스코프 드리프트 감지 + 적대적 리뷰. 기계적 이슈는 즉시 자동 수정. |
| **health-checker** | sonnet | 코드 품질 대시보드. 7개 카테고리별 가중 점수 (0-10)와 트렌드 추적. |

### 보안 & 운영 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **security-auditor** | opus | OWASP Top 10 + STRIDE 위협 모델 기반 10단계 보안 감사. 신뢰도 게이트 적용. |
| **canary-monitor** | sonnet | 배포 후 프로덕션 상태 모니터링. 페이지 로드, API 응답, 콘솔 에러, 성능 비교. |
| **shipper** | sonnet | 8가지 사전 점검 후 배포. Semver 결정 프레임워크로 버전 자동 판단. 체인지로그 자동 생성, PR 템플릿, 배포 후 검증까지. |

### 전문가

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **investigator** | sonnet | 5가지 증거 수집 → 가설 수립 (확률 기반) → 가설 검증 → 수정. 12가지 대표 버그 패턴 내장. 무관한 코드 수정 자동 차단. |

---

## 10가지 운영 모드

`@buildcrew`에게 자연스럽게 말하면 됩니다. 모드는 자동으로 감지됩니다.

| 모드 | 예시 | 파이프라인 |
|------|------|----------|
| **Feature** | "유저 대시보드 추가해줘" | 기획 → 디자인 → 개발 → QA → 브라우저 QA → 리뷰 |
| **Project Audit** | "프로젝트 전체 점검해줘" | 스캔 → 우선순위 → 수정 → 검증 (반복) |
| **Browser QA** | "브라우저 테스트해줘" | Playwright 테스트 + 건강 점수 |
| **Security** | "보안 점검해줘" | OWASP + STRIDE + 시크릿 + 의존성 |
| **Debug** | "왜 로그인이 안 돼?" | 4단계 근본 원인 조사 |
| **Health** | "헬스체크 돌려줘" | 품질 대시보드 |
| **Canary** | "배포 확인해줘" | 프로덕션 모니터링 |
| **Review** | "코드 리뷰해줘" | 4전문가 병렬 리뷰 + 자동 수정 |
| **Ship** | "배포해줘" | 사전 점검 → 테스트 → 버전 → 체인지로그 → PR |

### 반복 실행

매 반복마다 전체 파이프라인을 처음부터 다시 돌립니다. 기획자가 이전 결과를 읽고 계획을 수정하고, 개발자가 다시 구현하고, QA가 다시 검증합니다:

```
@buildcrew 유저 대시보드 추가해줘, 5 iterations
```

### 모드 체이닝

Feature 완료 → Ship 제안 → Canary 제안. Canary에서 문제 발견 → Debug 자동 전환.

---

## 기능 파이프라인

기능마다 전체 문서 체인이 자동 생성됩니다:

```
.claude/pipeline/{기능명}/
├── 01-plan.md           요구사항 + 4관점 리뷰 점수
├── 02-references.md     UI/UX 레퍼런스
├── 02-design.md         디자인 결정 + 컴포넌트 스펙
├── 03-dev-notes.md      구현 노트 + 6질문 분석 + 자체 리뷰 점수
├── 04-qa-report.md      테스트 맵 + 수용 기준 검증 + 버그 리포트
├── 05-browser-qa.md     건강 점수 + 스크린샷 + 유저 플로우
├── 06-review.md         4전문가 발견사항 + 자동 수정 내역
└── 07-ship.md           PR URL + 릴리즈 노트
```

---

## CLI

| 명령어 | 설명 |
|--------|------|
| `npx buildcrew` | 에이전트 설치 (11개 + 오케스트레이터) |
| `npx buildcrew init` | 하네스 자동 생성 (질문 없이 코드베이스 분석) |
| `npx buildcrew init --force` | 하네스 재생성 |
| `npx buildcrew add` | 사용 가능한 템플릿 목록 |
| `npx buildcrew add <name>` | 템플릿 추가 (erd, architecture 등) |
| `npx buildcrew harness` | 하네스 파일 상태 확인 |
| `npx buildcrew --force` | 에이전트 덮어쓰기 |
| `npx buildcrew --list` | 에이전트 목록 + 모델 정보 |
| `npx buildcrew --uninstall` | 에이전트 제거 |
| `npx buildcrew --version` | 버전 확인 |

## 요구사항

- **필수**: [Claude Code](https://claude.ai/code) CLI
- **선택**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — browser-qa, canary-monitor, designer가 사용
- **선택**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — designer가 사용

```bash
# 실제 브라우저 테스트 활성화
claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright
```

## 커스터마이징

```
.claude/agents/      에이전트 정의 — 역할, 도구, 모델 수정 가능
.claude/harness/     프로젝트 컨텍스트 — 언제든 수정, .md 파일 자유 추가
.claude/pipeline/    결과물 — 기능별 자동 생성
```

## 실시간 진행 상태

모든 에이전트가 이모지 태그된 진행 로그를 출력합니다:

```
📋 PLANNER — "유저 대시보드" 요구사항 분석 시작
🧠 6가지 강제 질문 분석...
🔎 4관점 자체 리뷰...
   🏢 CEO: 8/10  ⚙️ 엔지니어링: 9/10  🎨 디자인: 9/10  🧪 QA: 8/10
✅ PLANNER — 완료 (평균: 8.5/10)

💻 DEVELOPER — 구현 시작
🔍 6가지 구현 질문 분석...
🏗️ 구현 중...
🔎 3관점 자체 리뷰 — 아키텍처: 8/10, 품질: 9/10, 안전성: 7/10
✅ DEVELOPER — 완료 (12개 파일 변경, 평균: 8.0/10)

🧪 QA TESTER — 테스트 맵 구축 → 검증 중
   ✅ AC-1: 통과  ❌ AC-2: 실패 (신뢰도: 9/10)
🔬 REVIEWER — 4전문가 + 적대적 리뷰 — 승인 (2건 자동 수정)
```

## 아키텍처

```
@buildcrew (오케스트레이터, opus)
    │
    ├─ .claude/harness/*.md 읽기
    ├─ 유저 메시지에서 모드 자동 감지
    ├─ 하네스 컨텍스트와 함께 에이전트 디스패치
    └─ 품질 게이트 적용 + 전체 파이프라인 반복 관리
         │
         ├── 빌드:    planner → designer → developer
         ├── 품질:    qa-tester → browser-qa → reviewer
         ├── 보안/운영: security-auditor, canary-monitor, shipper
         └── 디버그:   investigator
```

## 라이선스

MIT
