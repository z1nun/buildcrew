# buildcrew

> [English](README.md) | **한국어** | [문서](https://buildcrew-landing.vercel.app)

Claude Code를 위한 11개 AI 에이전트 — 9개 운영 모드로 자동 오케스트레이션되는 개발 팀.

```bash
npx buildcrew
```

---

## 왜 buildcrew인가?

AI 코딩 에이전트는 강력하지만 구조 없이는 일관성 없는 결과를 냅니다. buildcrew는 Claude Code에 다음을 제공합니다:

- **팀** — 11개 전문 에이전트 (5 opus + 6 sonnet)
- **프로세스** — 품질 게이트와 반복을 갖춘 순차 파이프라인
- **하네스** — 코드베이스에서 자동 감지한 프로젝트 컨텍스트
- **오케스트레이터** — `@buildcrew`에게 말하면 자동으로 적절한 에이전트 배치

```
나:     @buildcrew 유저 인증 추가해줘
크루:   기획자 → 디자이너 → 개발자 → QA → 브라우저 QA → 리뷰어 → 배포
```

외부 의존성 없음. 런타임 없음. 바이너리 없음. 그냥 마크다운.

---

## 시작하기

```bash
# 1. 에이전트 설치
npx buildcrew

# 2. 프로젝트 하네스 자동 생성 (질문 없음)
npx buildcrew init

# 3. 커스터마이징 (생성된 파일에서 <!-- 주석 --> 부분만 수정)
code .claude/harness/

# 4. 사용
@buildcrew 유저 대시보드 추가해줘
```

---

## 하네스 엔지니어링

`npx buildcrew init`은 코드베이스를 스캔해서 프로젝트 하네스를 생성합니다 — **질문 0개**.

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
| 컴포넌트 | `src/components/` 스캔 |
| API 라우트 | `src/app/api/` 스캔 |
| 다국어 | i18n 디렉토리 스캔 |

### 생성되는 파일

감지 결과에 따라 관련 하네스 파일이 자동 생성:

```
.claude/harness/
├── project.md        ← 항상 (프로젝트 컨텍스트, 스택, 컴포넌트, API 라우트)
├── rules.md          ← 항상 (프레임워크에 맞는 스마트 기본값)
├── erd.md            ← DB 감지 시
├── api-spec.md       ← API 라우트 발견 시
├── design-system.md  ← TailwindCSS 감지 시
├── architecture.md   ← 항상
└── user-flow.md      ← i18n 또는 5개+ 컴포넌트 시
```

### 커스터마이징

생성된 파일은 `<!-- HTML 주석 -->`으로 채워야 할 부분을 표시합니다. 나머지는 코드베이스에서 자동으로 채워져 있습니다.

```bash
npx buildcrew harness     # 어떤 파일을 편집해야 하는지 확인
```

### 열린 구조

`.claude/harness/`에 아무 `.md` 파일이나 추가 가능 — 에이전트가 전부 읽음:

```bash
npx buildcrew add glossary    # 템플릿에서 추가
npx buildcrew add env-vars    # 템플릿에서 추가
echo "# 메모" > .claude/harness/내메모.md  # 직접 생성도 가능
```

### 에이전트 라우팅

| 파일 | 읽는 에이전트 |
|------|-------------|
| `project.md`, `rules.md` | 모든 에이전트 |
| `erd.md`, `architecture.md`, `api-spec.md` | developer, reviewer, security-auditor, investigator |
| `design-system.md` | designer |
| `glossary.md`, `user-flow.md` | planner, designer, browser-qa |
| `env-vars.md` | developer, security-auditor |
| 커스텀 `.md` | reviewer, security-auditor (전부 읽음) |

---

## 에이전트

### 빌드 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **planner** | opus | 6가지 강제 질문 + 4관점 자체 리뷰 (CEO, 엔지니어링, 디자인, QA). 관점별 1-10점. |
| **designer** | opus | 웹에서 UI/UX 레퍼런스 수집 → Playwright 스크린샷 → Figma MCP → 프로덕션 컴포넌트. AI 슬롭 블랙리스트. |
| **developer** | sonnet | 기획서 + 디자인 + 하네스 규칙에 따라 구현. |

### 품질 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **qa-tester** | sonnet | 코드 레벨 검증 — 타입, 린트, 빌드, 수용 기준. |
| **browser-qa** | sonnet | Playwright MCP 실제 브라우저 테스트 — 유저 플로우, 반응형, 콘솔, 건강 점수 (0-100). |
| **reviewer** | opus | 4관점 병렬 리뷰 (보안, 성능, 테스트, 유지보수) + 적대적 리뷰 + 자동 수정. |
| **health-checker** | sonnet | 코드 품질 대시보드 — 7개 카테고리 가중 점수 (0-10) + 트렌드. |

### 보안 & 운영 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **security-auditor** | opus | OWASP Top 10 + STRIDE 위협 모델. 10단계 감사 + 신뢰도 게이트. |
| **canary-monitor** | sonnet | 배포 후 프로덕션 헬스 — 페이지, API, 콘솔, 성능 비교. |
| **shipper** | sonnet | 릴리즈 파이프라인 — 테스트 → 버전 → 체인지로그 → PR. |

### 전문가

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **investigator** | sonnet | 근본 원인 디버깅. 4단계 조사. 무관한 코드 수정 동결. |

---

## 9가지 운영 모드

`@buildcrew`에게 자연스럽게 말하세요. 모드를 자동 감지합니다.

| 모드 | 예시 | 파이프라인 |
|------|------|----------|
| **Feature** | "유저 대시보드 추가해줘" | 기획 → 디자인 → 개발 → QA → 브라우저 QA → 리뷰 |
| **Project Audit** | "프로젝트 전체 점검해줘" | 스캔 → 우선순위 → 수정 → 검증 (반복) |
| **Browser QA** | "브라우저 테스트해줘" | Playwright 테스트 + 건강 점수 |
| **Security** | "보안 점검해줘" | OWASP + STRIDE + 시크릿 + 의존성 |
| **Debug** | "왜 로그인이 안 돼?" | 4단계 근본 원인 조사 |
| **Health** | "헬스체크 돌려줘" | 품질 대시보드 |
| **Canary** | "배포 확인해줘" | 프로덕션 모니터링 |
| **Review** | "코드 리뷰해줘" | 멀티 전문가 + 적대적 + 자동 수정 |
| **Ship** | "배포해줘" | 테스트 → 버전 → 체인지로그 → PR |

### 모드 체이닝

Feature 완료 → Ship → Canary. Canary CRITICAL → Debug.

---

## 기능 파이프라인

```
.claude/pipeline/{기능명}/
├── 01-plan.md           요구사항 + 4관점 리뷰 점수
├── 02-references.md     UI/UX 레퍼런스
├── 02-design.md         디자인 결정 + 스펙
├── 03-dev-notes.md      구현 노트 + 변경 파일
├── 04-qa-report.md      수용 기준 검증
├── 05-browser-qa.md     건강 점수 + 스크린샷
├── 06-review.md         리뷰 발견사항 + 자동 수정
└── 07-ship.md           PR URL + 릴리즈 노트
```

---

## CLI 레퍼런스

| 명령어 | 설명 |
|--------|------|
| `npx buildcrew` | 11개 에이전트 설치 |
| `npx buildcrew init` | 하네스 자동 생성 (질문 없음) |
| `npx buildcrew init --force` | 하네스 재생성 |
| `npx buildcrew add` | 템플릿 목록 |
| `npx buildcrew add <name>` | 템플릿 추가 |
| `npx buildcrew harness` | 하네스 파일 상태 |
| `npx buildcrew --force` | 에이전트 덮어쓰기 |
| `npx buildcrew --list` | 에이전트 목록 |
| `npx buildcrew --uninstall` | 에이전트 제거 |

## 요구사항

- **필수**: [Claude Code](https://claude.ai/code) CLI
- **선택**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — browser-qa, canary-monitor, designer
- **선택**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — designer

## 라이선스

MIT
