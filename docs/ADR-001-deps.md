# ADR-001: Dependency Policy — Principled Lean-Dep

- **Status**: Accepted (v2)
- **Date**: 2026-04-15 (v1), 2026-04-15 (v2, revised after adversarial review)
- **Decider**: z1nun
- **Next review**: 2026-10-15 (6-month cadence)

## Scope

이 정책이 다루는 것:
- `dependencies` (런타임 npm deps)
- `peerDependencies` (금지. `npx buildcrew`는 호스트의 패키지 트리에 의존하지 않아야 한다)
- `optionalDependencies` (허용하지만 반드시 graceful fallback 구현)
- **MCP 서버** (de facto 런타임 deps로 간주. 아래 MCP 섹션 참조)

이 정책이 다루지 않는 것:
- `devDependencies` — 개발 시점 도구(vitest 등)는 자유. 단, `npm audit` 주기적 확인 권장.
- CI/CD 파이프라인, 랜딩 페이지(`buildcrew-landing.vercel.app`), GitHub Actions 등 BuildCrew 패키지 외부 인프라.

**플랫폼 스코프**: macOS + Linux (Node 18.x ~ 22.x). **Windows는 현재 non-goal.** `lib/hook.js`의 `/dev/tty` 사용, `bin/watch.js`의 ANSI 가정 등이 Windows에서 깨지는 건 인지하고 있음. Windows 지원이 goal이 되는 날 이 ADR을 재작성한다.

## Context

BuildCrew v1.9.0은 런타임 npm 의존성이 0개다 (1,604 LOC, `node:` 내장만 사용). 하지만 이건 순수한 zero-dep이 아니다:

- `bin/setup.js` (719 LOC)는 harness 자동 감지, 대화형 프롬프트, hook 설치 로직을 포함한 non-trivial한 도메인 로직이다. 단순 "운반 수단"이라 부르면 결과(deps 안 씀)를 원인(carrier는 얇다)으로 둔갑시키는 왜곡이 된다. 정직하게 말하면: **carrier는 얇지 않지만, 얇게 유지하려 노력한다.**
- 에이전트 중 `designer`는 Playwright MCP를 강제 요구한다. 사용자는 `claude mcp add playwright`를 실행해야 한다. **MCP 서버는 사용자가 설치하는 런타임 dep이다.** "npm dep 0개"는 이 사실을 숨기는 bookkeeping이 될 수 있다.

이 ADR은 "zero-dep을 지키자"가 아니라 **"dep 결정을 판단 근거 있는 기록으로 남기자"**가 목적이다.

## Decision

dep 추가는 아래 4개 트리거 중 하나 이상에 해당하고, 이차 질문에 "yes"일 때 허용한다.

### Trigger 1: 계약 안정성 (Contract Stability)

외부에서 프로그램적으로 소비되는 데이터 계약(JSONL 이벤트 스키마 등)이 있고, 아래 중 하나:
- 소비자(파서/검증기)가 2개 이상 존재
- 수동 검증 로직이 단일 파일 내 80 LOC 이상 또는 3개 이상 파일에 흩어짐
- 지난 3개월 내 스키마 드리프트로 인한 실제 버그가 1건 이상 보고됨

측정 가능하게: "소비자 수", "LOC", "버그 이슈 번호"는 객관적이다.

### Trigger 2: 유저 대면 UX 파괴 (User-Facing UX Breakage)

지원 플랫폼(macOS/Linux, Node 18~22) 상에서 실제 사용자가 설치/실행에 실패한 리포트가 접수되고, 자체 구현으로 수정 시도 후에도 재발. 지원 플랫폼 기준이라 Windows 이슈는 여기 해당 안 됨.

### Trigger 3: First-Instance Cost-Benefit (교체된 "3x 반복" 룰)

새 코드를 작성하기 **전에** 계산:
- dep이 삭제할 코드량 ≥ dep 자체 용량(install size)의 2배
- 그리고 dep의 transitive dep 수 ≤ 3
- 그리고 dep의 최근 1년 내 주요 릴리즈 존재 (활발히 유지보수)

세 조건 모두 충족이면 첫 도입 즉시 허용. 이건 "3번 반복" 룰이 좋은 모듈화를 벌주던 트랩을 대체한다.

### Trigger 4: Correctness (v2 신규)

아래 중 하나가 걸리면 dep 도입 즉시 허용. Threshold 없음:
- 데이터 원자성(atomicity) — 예: concurrent `appendFileSync`로 JSONL 이벤트 유실 위험 → SQLite 같은 원자 저장소
- 멀티 프로세스 동시성 안전성 — 여러 CC 세션이 동시에 hook 이벤트를 쓸 때
- 스키마 드리프트로 데이터 손상이 발생 가능한 경로

Correctness는 UX나 코드량과 무관하게 우선. "사용자가 데이터를 잃게 되는가?"가 기준.

### 이차 질문 (모든 dep 공통)

위 트리거 하나라도 통과했다면 최종 질문:

> "이 의존성을 추가하면 (a) 사용자가 `claude mcp add` 같은 외부 설치 부담이 늘어나는가, (b) `npx buildcrew` p95 시작 시간이 1초를 넘기는가, (c) supply chain audit 가능성이 눈에 띄게 떨어지는가?"

셋 중 하나라도 "yes"면 dep 기각, 다른 해법 탐색. 셋 다 "no"면 dep 허용 + Accepted Deps Log에 레코드.

## MCP Server Policy (v2 신규)

MCP 서버는 **사용자가 설치하는 de facto 런타임 의존성**으로 간주한다.

1. BuildCrew가 요구하는 MCP는 `README.md`에 명시적으로 나열. 현재 필수: Playwright MCP (designer 에이전트).
2. 신규 MCP 요구사항 추가는 dep 추가와 동일 게이트를 거친다 (4 트리거 + 이차 질문).
3. MCP가 없어도 BuildCrew 자체는 실행 가능해야 한다 (`bin/setup.js`, `bin/watch.js`는 MCP 무관). MCP는 특정 에이전트의 기능에만 영향.
4. MCP 서버가 안 깔려 있을 때 해당 에이전트는 fail fast + 명확한 설치 가이드 출력. 이미 designer 에이전트가 이 패턴 구현 (v1.8.7, commit `f6b53e0`).

## Node Version Bounds (v2 신규)

`package.json`의 `engines.node`은 `>=18 <23` 범위로 관리. Node 23+ 테스트 전까지 상한 명시. 특히 `node:fs.watchFile`과 `node:readline`의 스트림 세만틱 변화 가능성 때문.

## Success Criteria / Measurements (v2 신규)

이 ADR이 살아있다는 걸 수치로 확인:

1. **Startup budget**: `npx buildcrew --version` p95 < 1s (로컬 캐시 상태 기준). CI에서 측정 고려 — 지금은 수동 벤치마크로 시작, 회귀 발생 시 자동화.
2. **Carrier thinness**: bin/ + lib/ LOC. v1.9.0 기준선 1,604 LOC. v2.x에서 2,500 LOC를 넘기면 ADR의 "얇게 유지" 클레임 재평가.
3. **Accepted deps count**: 현재 0. 이 숫자가 5를 넘으면 ADR 전반 재작성.

## Consequences

### Positive

- dep 결정이 기록 가능한 판단으로 전환 — 이데올로기가 아니라 엔지니어링.
- 미래의 기여자/본인이 "왜 이 dep이 있고 다른 건 없는지" 즉시 이해.
- Correctness 이슈는 즉시 해결 (trap: UX/coverage 이슈는 아닌데 데이터 손실 나는 케이스).
- MCP 부담을 명시적으로 관리 — 사용자 설치 부담 최소화 제약이 의사결정에 들어옴.

### Negative

- 각 dep 제안이 반사가 아니라 4개 트리거 + 이차 질문 절차를 거침. 오버헤드 증가.
- Windows 지원 포기의 명시화 — 미래 Windows 사용자 요청이 오면 이 ADR 자체를 재논의해야 함.

### Neutral

- devDependencies는 이 정책 밖. 빌드/테스트 도구는 자유지만 `npm audit` 주기적 확인 습관화.

## Accepted Deps Log

현재 허용된 런타임 deps: **없음** (v1.9.0 기준).

신규 dep 추가 시 형식:

```
- YYYY-MM-DD: <dep-name>@X.Y.Z
  Trigger: 1/2/3/4 (which one) + 근거 1-2줄
  이차 질문 답변: (a) MCP 부담 변화, (b) startup 시간 영향, (c) audit 가능성
  Install size: <kb>, Transitive: <count>, Last major: <date>
```

## Known Future Scenarios That Would Rewrite This ADR

- **Windows 지원이 goal이 됨** — Scope 변경, Trigger 2 범위 변경 필요.
- **Polyglot 확장** — Python/Rust 같은 non-Node 런타임이 필요한 에이전트가 생기면 "npm dep" 프레이밍 자체 재검토.
- **Accepted deps 5개 초과** — "lean"의 의미 재정의 필요.
- **BuildCrew가 개인 도구에서 팀 도구로 전환** — "사용자 = 본인" 가정 붕괴. Trigger 2의 "리포트" 정의 재설계.

## References

- v1 → v2 개정 근거: Claude 서브에이전트 adversarial review (2026-04-15). 주요 지적: (a) 3x repetition trap, (b) MCP 누락, (c) correctness 테스트 부재, (d) Windows 차별, (e) 측정 가능한 success criteria 부재.
- 이 ADR의 배경 분석: `~/.gstack/projects/z1nun-buildcrew/jinwon-feat-dashboard-design-20260415-102713.md`
- 관련 피벗: commit `8f2e936` (Phaser dashboard → terminal-native watch)
