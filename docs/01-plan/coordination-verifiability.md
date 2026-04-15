# Plan: Coordination Verifiability

- **Feature**: `coordination-verifiability`
- **Author**: z1nun
- **Date created**: 2026-04-15
- **Branch**: `feat/coordination-verifiability` (권장 신규 브랜치 — 현재 `feat/dashboard`의 작업과 분리)
- **Related**:
  - ADR-001 (Dependency Policy) — Trigger 1 (Contract Stability) 적용 케이스
  - `~/.gstack/projects/z1nun-buildcrew/jinwon-feat-dashboard-design-20260415-102713.md` (office-hours 배경)
  - Dashboard Design 2026-04-14 (memory) — APPROVED 이후 deprioritized 된 시각화 방향의 재해석

## Executive Summary

| 항목 | 값 |
|---|---|
| Feature | coordination-verifiability |
| 계획 시작일 | 2026-04-15 |
| 예상 완료일 | 2026-04-22 (7일) |
| 예상 총 소요 | Plan 30분 + Design 1시간 + Do 3시간 + Check 1시간 ≈ 5~6시간 |

| Value Perspective | 내용 |
|---|---|
| **Problem** | BuildCrew가 15개 에이전트를 "팀"이라 부르는데 에이전트들이 실제로 서로의 출력을 읽고 반영하는지 증명할 방법이 없다. 타임라인 이벤트(events.jsonl)는 "누가 언제 실행됐는지"만 알려주고 "B가 A의 출력을 실제로 사용했는지"는 신앙의 영역. Dashboard/watch를 만들어도 같은 불안이 남음. |
| **Solution** | 협업의 증거(provenance)를 에이전트 출력 markdown 자체에 심는다. 3개 변경: (1) 모든 agent.md에 "Handoff Record" 출력 섹션 강제, (2) 새 메타 에이전트 `coherence-auditor`가 파이프라인 끝에 크로스 체크, (3) buildcrew.md orchestrator에 강제 조항 추가. |
| **Function UX Effect** | 매 Feature 모드 실행 끝에 "진짜 협업률 X%" 점수와 gap 리스트. 고립된 에이전트(혼자 일한 증거) 자동 탐지. watch.js/dashboard는 시간축이 아니라 **인과 그래프**를 그리는 도구로 역할 전환. |
| **Core Value** | BuildCrew의 근본 가치 검증: "이건 진짜 팀인가, 순차 실행되는 15개 독립 스크립트인가?" 이 질문에 정량값(숫자 + 그래프)으로 답할 수 있게 된다. 사용자의 도구 신뢰가 극장에서 증거로 이동. |

## 문제 정의

### 현재 상태
- BuildCrew v1.9.0은 15개 에이전트를 13개 모드로 orchestrate 한다 (buildcrew.md)
- 에이전트 간 협업은 `.claude/pipeline/{feature-name}/` 하위 파일로 handoff (01-plan.md, 02-design.md, 03-impl.md 등)
- 각 에이전트는 CC Agent 툴로 fresh subagent로 실행 → context 격리
- 관찰 도구: `bin/watch.js`(473 LOC terminal TUI) + 과거 Phaser dashboard (삭제됨)

### 측정 가능한 것 / 측정 불가능한 것

| 측정 | 도구 | 상태 |
|---|---|---|
| 시간적 협업 — A 실행 후 B 실행 순서 | events.jsonl + watch.js | ✅ 잘 됨 |
| 인과적 협업 — B가 A의 출력을 실제로 읽고 반영 | **없음** | ❌ 신앙 |
| 고립 에이전트 탐지 — 이 에이전트가 팀과 상호작용 안 함 | **없음** | ❌ 발견 불가 |
| 파이프라인 일관성 — planner 요구사항 N개 중 몇 개가 구현/검증됐나 | **없음** | ❌ 사후 수작업 |

### 왜 지금인가
- 사용자가 "13 agents가 독립적으로 상호작용하는지 의심"이라고 명시적으로 말함 (office-hours 2026-04-15)
- Dashboard 만들었다 버리고, watch 만드는 중이고, zero-dep 재검토하는 행위 전부 이 한 질문의 증상
- 이 질문이 해결되지 않으면 추가 기능 개발(agents 리팩토링, 새 모드 등) 모두 같은 불안 위에 쌓임

## 목표 (North Star)

**"이건 진짜 팀인가?" 질문에 매 실행마다 정량 답변이 나온다.**

구체적으로:
- 매 Feature 모드 실행 끝에 "Coordination Score: 82% — 2개 gap, 0개 fabrication"
- 어느 에이전트가 어느 에이전트의 어느 섹션을 읽었는지 기계 판독 가능한 기록 존재
- 사람이 읽기도, 도구가 파싱하기도 둘 다 가능한 포맷

## 범위

### In scope
1. **Handoff Record 포맷 정의** — 모든 agent.md가 출력 끝에 포함해야 하는 표준 섹션
2. **15개 agent.md 수정** — 각 에이전트의 Output format 섹션에 Handoff Record 요구사항 추가
3. **`coherence-auditor` 신규 에이전트** — agents/coherence-auditor.md 작성 + buildcrew.md 팀원 표에 추가
4. **buildcrew.md 수정** — Feature 모드 Enforcement rules에 Handoff Record 강제 조항 추가 (rule 6), coherence-auditor 필수 실행 단계 추가
5. **Coherence Report 스키마** — coherence-auditor가 출력하는 `.claude/pipeline/{feature}/coherence-report.md` 포맷
6. **README 업데이트** — 새 기능 1단락 소개

### Out of scope (차기)
- watch.js를 인과 그래프 뷰로 개선 (Phase 2, 별도 Plan)
- Dashboard 재도입 (Phase 3, coherence-report가 충분히 성숙한 후)
- 과거 실행(이미 완료된 .claude/pipeline/)의 소급 분석
- Handoff Record를 다른 모드(Mode 2~13)에도 강제 — 우선 Mode 1 (Feature)에서 검증 후 확장
- 자동 재실행(coherence score 낮으면 재실행) — 먼저 리포트만 보고 패턴 관찰

## 영향 파일

### 수정 (17 files)

| 파일 | 변경 종류 | 예상 크기 |
|---|---|---|
| `agents/buildcrew.md` | Enforcement rule 추가, coherence-auditor 팀원 등록, Status Log 섹션에 점수 표시 | ~40줄 추가 |
| `agents/planner.md` | Handoff Record 요구 | ~20줄 |
| `agents/designer.md` | Handoff Record 요구 | ~20줄 |
| `agents/developer.md` | Handoff Record 요구 (읽어서 구현한 Input section 명시 강제) | ~25줄 |
| `agents/qa-tester.md` | Handoff Record 요구 | ~20줄 |
| `agents/browser-qa.md` | Handoff Record 요구 | ~20줄 |
| `agents/reviewer.md` | Handoff Record 요구 (Fabrication flag 강화) | ~25줄 |
| `agents/health-checker.md` | Handoff Record 요구 | ~20줄 |
| `agents/security-auditor.md` | Handoff Record 요구 | ~20줄 |
| `agents/canary-monitor.md` | Handoff Record 요구 | ~20줄 |
| `agents/shipper.md` | Handoff Record 요구 | ~20줄 |
| `agents/thinker.md` | Handoff Record 요구 | ~20줄 |
| `agents/architect.md` | Handoff Record 요구 | ~20줄 |
| `agents/design-reviewer.md` | Handoff Record 요구 | ~20줄 |
| `agents/investigator.md` | Handoff Record 요구 | ~20줄 |
| `agents/qa-auditor.md` | Handoff Record 요구 | ~20줄 |
| `README.md` | "Verifiable Coordination" 섹션 추가 | ~15줄 |

### 신규 (3 files)
| 파일 | 내용 |
|---|---|
| `agents/coherence-auditor.md` | 신규 메타 에이전트 (sonnet 모델). Handoff Record 파싱 + 크로스 체크 + coherence-report.md 생성 | ~150줄 |
| `docs/02-design/coordination-verifiability.md` | 설계 문서 (Handoff Record 스키마 상세, coherence-auditor 로직, gap/fabrication 판정 규칙) | ~200줄 |
| `docs/03-analysis/coordination-verifiability.md` | Gap analysis (설계-구현 매칭) | 작성 시점 결정 |

### 건드리지 않음
- `bin/*.js`, `lib/*.js` — Node 코드 한 줄도 수정 없음 (ADR-001 원칙 유지)
- `package.json` — 의존성 변경 없음
- `templates/` — harness 템플릿 무관

## User Stories

### US-1: 매 Feature 실행 후 coordination score를 본다
- **As** BuildCrew 사용자
- **I want** Feature 모드가 끝나면 "Coordination Score: 82%, 2 gaps, 0 fabrications" 같은 정량 요약을 본다
- **So that** 팀이 실제로 협업했는지 즉시 판단할 수 있다

**Acceptance Criteria**:
- [ ] Feature 모드 완료 시 `.claude/pipeline/{feature}/coherence-report.md` 생성
- [ ] Report에 overall score (0-100%) 포함
- [ ] Report에 gap 리스트 (예: "planner Requirement #3 → developer 구현 누락")
- [ ] Report에 fabrication 리스트 (예: "reviewer가 planner 인용했으나 원문에 없음")
- [ ] buildcrew.md의 최종 📊 buildcrew Report에 점수 노출

### US-2: 에이전트가 어디서 뭘 읽었는지 추적한다
- **As** BuildCrew 사용자/디버거
- **I want** 각 에이전트 출력 끝에 Handoff Record 섹션을 본다
- **So that** 협업 근거를 수동으로도 검증할 수 있다

**Acceptance Criteria**:
- [ ] 15개 agent.md 모두 Handoff Record 요구사항 명시
- [ ] Handoff Record 포맷 문서화 (docs/02-design/ 내)
- [ ] 최소 필수 필드: Inputs consumed, Outputs for next agents, Decisions NOT covered by inputs
- [ ] 누락 시 buildcrew orchestrator가 해당 에이전트 재실행

### US-3: 고립 에이전트를 조기 탐지한다
- **As** BuildCrew 개발자 (z1nun 본인)
- **I want** 특정 에이전트가 계속 Handoff Record에서 다른 에이전트를 거의 인용하지 않는 패턴을 발견한다
- **So that** 그 에이전트의 프롬프트 설계 결함을 찾아 수정한다

**Acceptance Criteria**:
- [ ] coherence-auditor가 에이전트별 citation density 메트릭 산출
- [ ] 3회 이상 실행에서 citation density 20% 이하인 에이전트 → 경고 표시
- [ ] (선택) 주간 리포트: 에이전트별 평균 citation density 추이

## 기술적 고려사항

### Handoff Record 포맷 (초안 — Design 단계에서 확정)

```markdown
## Handoff Record

### Inputs consumed
- `{file}:{section}` → {영향받은 내 출력 위치}
- (반복)

### Outputs for next agents
- `{file}:{section}` (무엇에 대한 기록인지)
- (반복)

### Decisions NOT covered by inputs
- {결정 사항} — {근거 1-2줄}

### Coordination signals (optional)
- Referenced {agent-id}: {how}
- Conflicted with {agent-id} on: {topic} — {resolution}
```

### Coherence Auditor 로직 (초안)

1. `.claude/pipeline/{feature}/` 하위 모든 `*.md` 수집
2. 각 파일의 Handoff Record 섹션 추출 (markdown 파싱, 실패 시 Handoff Record 누락으로 flag)
3. 크로스 체크:
   - **Gap**: Agent A의 Outputs에 X 언급 → Agent B의 Inputs에 X 없음 → "B가 A의 X를 놓침"
   - **Fabrication**: Agent B의 Inputs에 Y 인용 → Agent A의 Outputs/원문에 Y 없음 → "B가 허위 인용"
   - **Orphan**: Agent A의 Outputs에 N개 항목 → 후속 에이전트 아무도 참조 안 함 → "A의 작업 N% 버려짐"
4. Score 계산: (실제 협업 edge 수) / (가능한 edge 수) × 100
5. `coherence-report.md` 출력

### Score 해석 가이드 (초안)
- 90% 이상 = 건강한 팀
- 70~90% = 일반적 (약간의 gap)
- 50~70% = 의심 (설계 점검 필요)
- 50% 미만 = 극장 (팀이 아님)

## 위험과 완화

| 위험 | 영향 | 확률 | 완화 |
|---|---|---|---|
| 에이전트가 Handoff Record를 형식적으로만 작성 (거짓 인용) | High | Med | coherence-auditor가 Fabrication 탐지. 또한 reviewer 에이전트에 "이전 에이전트 Handoff Record 검증" 책임 추가 |
| Handoff Record 파싱이 markdown 변형에 깨짐 | Med | Med | 엄격한 포맷 + fallback 파서 + Design 단계에서 포맷 단순화 |
| coherence score가 낮아도 사용자가 무시하게 됨 | Med | Low | 초기 점수는 경고성(정보 제공)으로만, 1개월 관찰 후 enforcement 여부 결정 |
| 15개 agent.md 수정 중 일부 누락 → 부분 도입으로 score가 왜곡됨 | High | Low | 일괄 수정 + 수정 체크리스트 + vitest로 각 agent.md가 Handoff Record 요구 포함하는지 테스트 |
| Node 코드 수정 없이 markdown만으로는 parser 신뢰성 확보 어려움 | Med | Med | ADR-001 Trigger 1 (Contract Stability) 활성화 트리거가 될 수 있음. 파서 2번째 소비자(사람/도구) 생기는 시점 판단. 당장은 coherence-auditor 자체가 유일 소비자 |
| 신규 브랜치와 현재 `feat/dashboard`의 변경 충돌 | Low | Low | `feat/coordination-verifiability` 별도 브랜치로 분리. feat/dashboard는 지금 상태로 정리 후 merge or 보류 |

## 마일스톤

| 마일스톤 | 완료 조건 | 예상 시간 |
|---|---|---|
| M1: Plan 승인 | 이 문서 사용자 승인 | (이 대화) |
| M2: Design 완성 | `docs/02-design/coordination-verifiability.md` — Handoff Record 스키마 확정, coherence-auditor 의사코드 | 1시간 |
| M3: agents/*.md 수정 완료 | 15개 agent.md + buildcrew.md + coherence-auditor.md 신규 | 2시간 |
| M4: README 업데이트 | "Verifiable Coordination" 섹션 + 예시 coherence-report 스크린샷 | 30분 |
| M5: Dog-fooding | BuildCrew 자체의 최근 작업(예: ADR-001-deps.md 작성)을 Feature 모드로 돌리고 coherence-report 확인 | 1시간 |
| M6: Gap analysis | `docs/03-analysis/` 에 설계-구현 매칭 점수 | 1시간 |

## Success Metrics

1. **Coverage**: 15개 에이전트 중 15개가 Handoff Record 섹션을 포함 (100%)
2. **Auditability**: coherence-auditor가 M5의 dog-fooding 실행에서 의미 있는 gap/fabrication을 1개 이상 탐지 (sanity check — 0개면 파서가 무력하다는 뜻)
3. **User signal**: 사용자(z1nun)가 이 기능 도입 후 Feature 모드를 3회 이상 쓰고 "팀이 진짜 협업하는지" 질문을 다시 꺼내지 않음 (gap-detector 2주 뒤 검증)

## Priority / Urgency

- **Priority**: P0 — BuildCrew의 core value proposition("multi-agent team")을 검증 가능하게 만드는 기반. 미해결 시 모든 후속 개발이 같은 불안 위에 쌓임.
- **Urgency**: High — 사용자가 이미 대시보드, watch, zero-dep 등 증상으로 에너지를 분산 사용 중. 본질 해결이 에너지 수렴을 만든다.

## Next Step

이 Plan 승인 시 → `/pdca design coordination-verifiability`로 Design 단계 진입.

Design 단계에서 확정할 것:
- Handoff Record markdown 포맷 최종 (필드명, 순서, 필수/선택)
- coherence-auditor의 파싱 알고리즘 pseudo-code
- Score 계산 공식 상세 (edge 수 정의, weight 여부)
- 15개 에이전트별로 Handoff Record에 추가로 요구할 에이전트 특화 필드 (예: reviewer의 경우 "이전 에이전트 Handoff Record 중 거짓 인용으로 의심되는 것")
