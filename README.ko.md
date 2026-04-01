# buildcrew

Claude Code를 위한 11개 AI 에이전트 — 9개 운영 모드로 자동 오케스트레이션되는 개발 팀.

```bash
npx buildcrew
```

> [English](README.md) | **한국어**

---

## 왜 buildcrew인가?

AI 코딩 에이전트는 강력하지만 구조 없이는 일관성 없는 결과를 냅니다. buildcrew는 Claude Code에 다음을 제공합니다:

- **팀** — 명확한 역할을 가진 11개 전문 에이전트
- **프로세스** — 품질 게이트와 반복을 갖춘 순차 파이프라인
- **하네스** — 프로젝트 컨텍스트, 규칙, 도메인 지식이 모든 에이전트에 내장
- **오케스트레이터** — `@constitution`에게 말하면 자동으로 적절한 에이전트 배치

```
나:     @constitution 유저 대시보드 추가해줘
크루:   기획자 → 디자이너 → 개발자 → QA → 브라우저 QA → 리뷰어 → 배포
```

외부 의존성 없음. 런타임 없음. 바이너리 없음. 그냥 마크다운.

---

## 시작하기

```bash
# 1. 에이전트 설치
npx buildcrew

# 2. 프로젝트 하네스 설정 (인터랙티브)
npx buildcrew init

# 3. 추가 컨텍스트 (선택)
npx buildcrew add erd
npx buildcrew add architecture
npx buildcrew add design-system

# 4. 사용
@constitution 유저 대시보드 추가해줘
```

---

## 하네스 엔지니어링

하네스는 "범용 AI 출력"과 "내 프로젝트에 맞는 코드"의 차이를 만듭니다.

```bash
npx buildcrew init
```

인터랙티브 설정으로 핵심 하네스 파일 생성:

```
[1/3] 프로젝트 컨텍스트
  프로젝트명, 설명, 기술 스택 (자동 감지), 배포 타겟, 프로덕션 URL

[2/3] 팀 규칙
  코딩 컨벤션, 우선순위, 금지사항, 품질 기준, 리뷰 규칙

[3/3] 도메인 지식
  업종, 유저 타입, 도메인 용어, 비즈니스 룰
```

### 템플릿으로 추가 컨텍스트 제공

```bash
npx buildcrew add erd              # DB 스키마 & 관계
npx buildcrew add architecture     # 시스템 아키텍처
npx buildcrew add api-spec         # API 엔드포인트 & 계약
npx buildcrew add design-system    # 색상, 타이포, 컴포넌트
npx buildcrew add glossary         # 도메인 용어 & 유저 역할
npx buildcrew add user-flow        # 유저 여정 & 페이지 맵
npx buildcrew add env-vars         # 환경변수 가이드
```

### 열린 구조

템플릿에 제한되지 않습니다. `.claude/harness/`에 아무 `.md` 파일이나 추가하세요:

```
.claude/harness/
├── project.md          ← 핵심 (init으로 생성)
├── rules.md            ← 핵심 (init으로 생성)
├── erd.md              ← 템플릿 (add로 추가)
├── architecture.md     ← 템플릿 (add로 추가)
├── 내맘대로.md          ← 직접 작성 (에이전트가 읽음)
└── 무엇이든.md          ← 아무 .md 파일 가능
```

### 하네스 파일 → 에이전트 라우팅

| 파일 | 읽는 에이전트 |
|------|-------------|
| `project.md`, `rules.md` | 모든 에이전트 |
| `erd.md`, `architecture.md`, `api-spec.md` | developer, reviewer, security-auditor, investigator |
| `design-system.md` | designer |
| `glossary.md`, `user-flow.md` | planner, designer, browser-qa |
| `env-vars.md` | developer, security-auditor |
| 커스텀 파일 | reviewer, security-auditor (전부 읽음) |

### 하네스 관리

```bash
npx buildcrew harness          # 하네스 파일 상태 확인
npx buildcrew add              # 사용 가능한 템플릿 목록
npx buildcrew add erd          # 특정 템플릿 추가
npx buildcrew init --force     # 핵심 파일 재생성
```

---

## 에이전트

### 빌드 팀

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **planner** | opus | 6가지 강제 질문 + 4관점 자체 리뷰 (CEO, 엔지니어링, 디자인, QA). 관점별 1-10점 채점. |
| **designer** | opus | 웹에서 UI/UX 레퍼런스 수집, Playwright로 실제 사이트 스크린샷, Figma MCP 통합, 프로덕션 React/Next.js 컴포넌트 작성. AI 슬롭 블랙리스트. |
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
| **security-auditor** | opus | OWASP Top 10 + STRIDE 위협 모델. 10단계 감사. |
| **canary-monitor** | sonnet | 배포 후 프로덕션 헬스 — 페이지, API, 콘솔, 성능 비교. |
| **shipper** | sonnet | 릴리즈 파이프라인 — 테스트 → 버전 → 체인지로그 → PR. |

### 전문가

| 에이전트 | 모델 | 역할 |
|---------|------|------|
| **investigator** | sonnet | 근본 원인 디버깅. 4단계 조사. 무관한 코드 수정 동결. |

---

## 9가지 운영 모드

`@constitution`에게 자연스럽게 말하세요. 모드를 자동 감지합니다.

| 모드 | 예시 | 파이프라인 |
|------|------|----------|
| **Feature** | "유저 대시보드 추가해줘" | 기획 → 디자인 → 개발 → QA → 브라우저 QA → 리뷰 |
| **Project Audit** | "프로젝트 전체 점검해줘" | 스캔 → 우선순위 → 수정 → 검증 (반복) |
| **Browser QA** | "브라우저 테스트해줘" | Playwright 테스트 + 건강 점수 |
| **Security** | "보안 점검해줘" | OWASP + STRIDE + 시크릿 + 의존성 |
| **Debug** | "왜 로그인이 안 돼?" | 4단계 근본 원인 조사 |
| **Health** | "헬스체크 돌려줘" | 품질 대시보드 (타입, 린트, 의존성, i18n) |
| **Canary** | "배포 확인해줘" | 프로덕션 모니터링 |
| **Review** | "코드 리뷰해줘" | 멀티 전문가 + 적대적 + 자동 수정 |
| **Ship** | "배포해줘" | 테스트 → 버전 → 체인지로그 → PR |

### 모드 체이닝

Constitution이 다음 모드를 자동 제안:
- Feature 완료 → Ship 제안
- Ship 완료 → Canary 제안
- Canary CRITICAL → Debug 트리거

---

## 기능 파이프라인

각 기능이 완전한 문서 체인을 생성:

```
.claude/pipeline/{기능명}/
├── 01-plan.md           요구사항 + 4관점 리뷰 점수
├── 02-references.md     실제 사이트에서 수집한 UI/UX 레퍼런스
├── 02-design.md         디자인 결정 + 컴포넌트 스펙
├── 03-dev-notes.md      구현 노트 + 변경 파일
├── 04-qa-report.md      수용 기준 검증
├── 05-browser-qa.md     건강 점수 + 스크린샷 + 플로우
├── 06-review.md         리뷰 발견사항 + 자동 수정
└── 07-ship.md           PR URL + 릴리즈 노트
```

---

## CLI 레퍼런스

| 명령어 | 설명 |
|--------|------|
| `npx buildcrew` | 11개 에이전트 설치 |
| `npx buildcrew init` | 프로젝트 하네스 설정 (인터랙티브) |
| `npx buildcrew init --force` | 하네스 재생성 |
| `npx buildcrew add` | 사용 가능한 템플릿 목록 |
| `npx buildcrew add <type>` | 하네스 템플릿 추가 |
| `npx buildcrew harness` | 하네스 파일 상태 확인 |
| `npx buildcrew --force` | 기존 에이전트 덮어쓰기 |
| `npx buildcrew --list` | 에이전트 목록 (모델 포함) |
| `npx buildcrew --uninstall` | 에이전트 제거 |
| `npx buildcrew --version` | 버전 확인 |

## 요구사항

- **필수**: [Claude Code](https://claude.ai/code) CLI
- **선택**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — browser-qa, canary-monitor, designer용
- **선택**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — designer용

```bash
# 실제 브라우저 테스트 활성화
claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright
```

## 커스터마이징

모든 파일 수정 가능:

```
.claude/agents/      에이전트 정의 — 역할, 도구, 지시사항, 모델 수정
.claude/harness/     프로젝트 컨텍스트 — 언제든 수정, 아무 .md 추가
.claude/pipeline/    출력 문서 — 기능별 자동 생성
```

## 라이선스

MIT
