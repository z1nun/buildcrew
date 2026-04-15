# Design: Coordination Verifiability

- **Feature**: `coordination-verifiability`
- **Plan**: `docs/01-plan/coordination-verifiability.md`
- **Date**: 2026-04-15
- **Status**: DRAFT → pending review

## Executive Summary

| 항목 | 값 |
|---|---|
| Feature | coordination-verifiability |
| Design 작성일 | 2026-04-15 |
| 구현 예상 | 3시간 (M3) |
| Node 코드 수정 | 0줄 (markdown only) |

| Design Perspective | 내용 |
|---|---|
| **Handoff Record Spec** | 4개 섹션(Inputs / Outputs / Decisions / Coordination) + 엄격한 list-item 문법. Parser는 정규식 기반. 앵커는 GitHub-flavored markdown 규칙 준수. |
| **Parser Algorithm** | 3-pass 파싱 (section → item → reference resolution). Fabrication 탐지는 anchor resolution 단계에서. 실패 시 strict(재실행) vs. lenient(warn) 2모드. |
| **Score Formula** | `coordination = actual_edges / possible_edges × 100`. Edge는 downstream의 Input이 upstream Output을 가리킬 때 성립. Handoff Record 미준수 에이전트는 edge 0으로 계산. |
| **Integration** | buildcrew.md Mode 1(Feature)에 enforcement rule 6 추가. coherence-auditor를 파이프라인 강제 마지막 단계로. Phase 1은 info-only(점수만 노출), Phase 2에서 iteration 재실행 트리거. |

## 1. Handoff Record Format Specification

### 1.1 Location
모든 에이전트 출력 파일(`.claude/pipeline/{feature}/*.md`)의 **마지막 섹션**으로 `## Handoff Record`를 배치한다. 파일의 다른 곳에 두면 파서가 무시한다.

### 1.2 Required Subsections (in order)

```markdown
## Handoff Record

### Inputs consumed
- `<path>#<anchor>` → <used-for>
- ...

### Outputs for next agents
- `<path>#<anchor>` → <next-agent-role>
- ...

### Decisions NOT covered by inputs
- <decision>. Reason: <rationale>
- ...
```

위 3개 섹션은 **모두 필수**. 없으면 Handoff Record 미준수로 판정되어 해당 에이전트 재실행.

"없음" 의미는 명시적 `- none` 한 줄로 표현한다. 빈 섹션은 파싱 실패.

### 1.3 Optional Subsection

```markdown
### Coordination signals
- Referenced <agent-id>: <how>
- Conflicted with <agent-id> on <topic> — <resolution>
- Deferred <topic> to <agent-id>
```

### 1.4 Line Item Grammar

| 섹션 | 문법 (regex 기준) |
|---|---|
| Inputs consumed | `^- \`(?P<path>[^\`#]+)#(?P<anchor>[^\`]+)\` → (?P<used_for>.+)$` |
| Outputs for next agents | `^- \`(?P<path>[^\`#]+)#(?P<anchor>[^\`]+)\` → (?P<to>.+)$` |
| Decisions NOT covered | `^- (?P<decision>.+?)\. Reason: (?P<reason>.+)$` |
| Coordination signals | 3가지 패턴 중 하나: `Referenced`, `Conflicted with`, `Deferred` 시작 |

엄격한 문법을 고집하는 이유: **파서 복잡도를 낮추고 에이전트에게 "형식이 결과"라는 신호를 준다.** 느슨한 포맷은 결국 거짓 인용을 숨긴다.

### 1.5 Anchor Convention
Markdown heading을 GitHub-flavored rules로 앵커화:
- 소문자
- 공백 → `-`
- 영숫자/하이픈 외 문자 제거
- 중복 시 `-1`, `-2` 접미사

예: `### Requirements` → `#requirements`, `### Requirement #3` → `#requirement-3`

에이전트는 출력 작성 시 명시적으로 앵커 가능한 heading을 써야 한다 (한글은 그대로 앵커 허용 — GFM 규칙).

### 1.6 Path Convention

| 케이스 | path 표기 |
|---|---|
| 파이프라인 내 파일 | `01-plan.md` (상대경로, `.claude/pipeline/{feature}/` 기준) |
| harness 파일 | `harness/{name}.md` |
| 소스 파일(참조만) | `src/...`, `lib/...` 등 저장소 상대경로 |
| 유효하지 않음 | 절대경로, `~/...`, 외부 URL |

### 1.7 Full Example (developer agent output tail)

```markdown
## Handoff Record

### Inputs consumed
- `01-plan.md#requirements-3` → Implemented pagination at src/List.tsx:45-78
- `01-plan.md#requirements-5` → Added error boundary at src/List.tsx:112-130
- `02-design.md#component-tree` → Followed file structure under src/components/
- `harness/architecture.md#api-patterns` → Used cursor-based pagination
- `harness/project.md#stack` → Confirmed Next.js 14 app-router

### Outputs for next agents
- `03-impl.md#components` → qa-tester (list of files changed)
- `03-impl.md#tests-needed` → qa-tester (pagination edge cases: empty, single-page, last-page)
- `03-impl.md#accessibility-notes` → browser-qa (aria-label choices documented)

### Decisions NOT covered by inputs
- Used cursor-based pagination. Reason: harness pattern was ambiguous, chose cursor per architecture.md precedent.
- Named component `ItemList` not `List`. Reason: avoid builtin name collision.
- Skipped skeleton loading UI. Reason: plan deferred to Phase 2, not in current scope.

### Coordination signals
- Referenced designer output `02-design.md#spacing` for padding-8 token
- Deferred empty-state illustration to designer in next iteration
```

## 2. Parser Specification

### 2.1 Pass 1: Section Extraction
1. Read file. Locate `^## Handoff Record$` (exact match, case-sensitive).
2. If absent → `MISSING_HANDOFF_RECORD`.
3. From that line to EOF (or next `^## ` heading, whichever first) = the HR block.

### 2.2 Pass 2: Subsection Parse
1. Within HR block, locate `^### Inputs consumed$`, `^### Outputs for next agents$`, `^### Decisions NOT covered by inputs$`.
2. If any of the 3 required is missing → `INCOMPLETE_HANDOFF_RECORD`.
3. For each subsection, extract lines starting with `^- ` until next `### ` or EOF.
4. If a required subsection has only `- none` → mark subsection as empty-but-acknowledged (valid).

### 2.3 Pass 3: Reference Resolution
For each Input line:
1. Regex parse into (path, anchor, used_for). Parse failure → `MALFORMED_INPUT`.
2. Resolve path to filesystem. Not found → `MISSING_FILE`.
3. Read target file, compute all GFM anchors from headings.
4. Anchor not in set → `FABRICATION` flag. (에이전트가 존재하지 않는 섹션을 인용함 = 거짓 인용)

Output lines: same path/anchor resolution but anchor 존재 검증만 (자기 파일이니 당연히 존재해야 함).

### 2.4 Error Modes

| Error | 원인 | 처리 (Phase 1) | 처리 (Phase 2) |
|---|---|---|---|
| MISSING_HANDOFF_RECORD | `## Handoff Record` 없음 | warn in report | 해당 에이전트 재실행 |
| INCOMPLETE_HANDOFF_RECORD | 3개 required subsection 중 누락 | warn | 재실행 |
| MALFORMED_INPUT | line item grammar 불일치 | warn | 재실행 |
| MISSING_FILE | 참조한 파일 없음 | warn, score에서 제외 | 재실행 |
| FABRICATION | 존재하지 않는 anchor 인용 | flag in report, score penalty | 재실행 + fabrication 표시 |

## 3. Score Computation

### 3.1 Edge Definition

**Edge**: upstream agent A의 Output `<path>#<anchor>`가 downstream agent B의 Input 섹션에 그대로 등장.

- A가 `03-impl.md#components` → qa-tester 이라 선언
- B(qa-tester)가 `03-impl.md#components` → ... 를 Input에 기재
- → edge(A→B) 성립

엄밀히 path+anchor 일치해야 함. path만 일치하고 anchor 다르면 edge 없음 (에이전트가 의도한 특정 섹션이 아니라 파일 전체를 뭉뚱그렸을 가능성).

### 3.2 Formulas

```
possible_edges = sum over all (A,B) where A is upstream of B in pipeline,
                 count of A.outputs addressed to B's role

actual_edges = sum over all (A,B),
               count of A.outputs that B.inputs explicitly references

coordination_score = (actual_edges / max(possible_edges, 1)) * 100

citation_density(agent) = cited_outputs(agent) / total_outputs(agent) * 100

orphan_candidate = citation_density(agent) < 20 AND total_outputs(agent) >= 2
```

### 3.3 Special Cases
- **Terminal agent** (reviewer, qa-auditor): outputs 없을 수 있음 → density 계산 제외.
- **First agent** (planner, thinker): inputs에 harness만 있을 수 있음 → 정상.
- **Parallel pipelines**: 현재 없음. 미래 도입 시 재설계.

### 3.4 Weight Options (deferred)

Phase 1에서는 edge를 모두 동등하게 센다. Phase 2에서 고려 가능한 weight:
- **Critical output weight**: planner가 "MUST" 라벨 붙인 요구사항이 무시되면 더 큰 penalty
- **Fabrication weight**: 1 fabrication = -5 score points (단순 gap보다 무거움)

Phase 1 범위 밖.

### 3.5 Thresholds

| Score | Status | Action |
|---|---|---|
| 90-100 | Healthy | 정보만 기록 |
| 70-89 | Normal | gap 리스트 제공, 사용자 판단 |
| 50-69 | Suspicious | 경고 표시 + 설계 리뷰 권고 |
| <50 | Theater | 강한 경고 ("이건 팀이 아님") + orchestrator 로그에 빨간색 |

## 4. Coherence Report Format

`.claude/pipeline/{feature}/coherence-report.md` 로 출력.

```markdown
# Coherence Report: {feature-name}

- Generated: {ISO-8601 timestamp}
- Iteration: {n}/{max}
- Pipeline: planner → designer → developer → qa-tester → browser-qa → reviewer

## Overall

- **Coordination Score**: 82% (9 actual / 11 possible edges)
- Status: Normal (minor gaps)
- Handoff Record compliance: 6/6 agents (100%)
- Fabrications: 0

## Gaps (2)

1. **Unused output**: `01-plan.md#requirements-4` (error state design) — planner emitted, no downstream cited.
   Suggested action: Add to designer brief next iteration, or mark as deferred.

2. **Missing consumption**: `02-design.md#accessibility-notes` — designer emitted, developer did not cite.
   Suggested action: Verify developer implemented accessibility attrs; if yes, update developer Handoff.

## Fabrications (0)

None detected.

## Orphans (0)

None detected.

## Per-Agent Citation Density

| Agent | Outputs | Cited | Density |
|---|---|---|---|
| planner | 5 | 4 | 80% |
| designer | 3 | 3 | 100% |
| developer | 4 | 3 | 75% |
| qa-tester | 2 | 1 | 50% |
| browser-qa | 1 | 1 | 100% |
| reviewer | 0 | — | — (terminal) |

## Per-Agent Handoff Compliance

| Agent | HR present | Inputs valid | Outputs declared | Decisions logged | Notes |
|---|---|---|---|---|---|
| planner | ✓ | ✓ | ✓ | ✓ | — |
| designer | ✓ | ✓ | ✓ | ✓ | — |
| developer | ✓ | ✓ | ✓ | ✓ | — |
| qa-tester | ✓ | ✓ | ✓ | ✗ | Decisions section missing (only `- none` allowed) |
| browser-qa | ✓ | ✓ | ✓ | ✓ | — |
| reviewer | ✓ | ⚠ | ✓ | ✓ | 1 input had weak grammar (warning, not fabrication) |

## Recommendations

1. Add error-state requirement to designer brief (gap #1)
2. Add explicit accessibility citation to developer Handoff (gap #2)
3. qa-tester: include at least `- none` in Decisions NOT covered section

## Raw Data

(machine-readable JSON for watch.js/dashboard integration)

```json
{
  "score": 82,
  "possible_edges": 11,
  "actual_edges": 9,
  "gaps": [...],
  "fabrications": [],
  "orphans": [],
  "agents": {
    "planner": {"citations_in": 0, "citations_out": 4, "outputs": 5, "hr_compliant": true},
    ...
  }
}
```
```

## 5. Per-Agent Extensions

15개 에이전트 중 **5개**는 기본 Handoff Record 외에 에이전트 특화 필드를 추가한다. 나머지 10개는 기본 포맷만.

### 5.1 `reviewer.md` — 이전 에이전트 Handoff 검증 책임

```markdown
### Coordination signals
- Verified Handoff Records of: planner, designer, developer, qa-tester
- Fabrication candidates found: 0
- Suspicious citations flagged: 1 (developer cited plan#requirements-5 but code changes don't reflect it — developer.md:review)
```

이게 있으면 reviewer가 coherence-auditor의 **인간 버전** 역할도 함. 에이전트가 에이전트를 감시하는 구조 → fabrication에 대한 2중 방어.

### 5.2 `investigator.md` — Root Cause Trace

```markdown
### Root cause trace
- Hypothesis: <hypothesis>
- Evidence collected: <file:line> (x N)
- Disproved hypotheses: <list>
- Final root cause: <statement> anchored at <file:line>
```

### 5.3 `thinker.md` — Assumption Chain

```markdown
### Assumption chain
- A1: <assumption>. If false: <consequence>
- A2: <assumption>. ...
- Verified externally: A1 (via <source>)
- Unverified: A2, A3
```

### 5.4 `qa-auditor.md` — Parallel Subagent Findings

```markdown
### Subagent findings consolidation
- Subagent 1 (correctness): N findings, top: <summary>
- Subagent 2 (performance): N findings, top: <summary>
- Subagent 3 (security): N findings, top: <summary>
- Cross-subagent conflicts: <none | list>
```

### 5.5 `design-reviewer.md` — UX Score Provenance

```markdown
### UX score provenance
- Score: N/10 across <dimensions>
- Dimension breakdown cited from: <source or heuristic>
- Low-scoring dimensions: <list> with specific fixes at <file:line>
```

나머지 10개 에이전트(planner, designer, developer, qa-tester, browser-qa, health-checker, security-auditor, canary-monitor, shipper, architect)는 기본 Handoff Record 4 섹션만 요구.

## 6. `coherence-auditor` Agent Specification

### 6.1 Agent Frontmatter

```yaml
---
name: coherence-auditor
description: Meta-agent that verifies coordination between pipeline agents via Handoff Record parsing AND source code cross-verification. Produces coherence-report.md with score + gap/fabrication/orphan analysis + code implementation verification.
model: opus
version: 1.0.0
tools:
  - Read
  - Glob
  - Grep
  - Write
---
```

Why opus (changed from sonnet after Q3 lock): 코드 교차 검증은 "이 코드가 이 요구사항을 구현하는가" 판단이 필요. sonnet으로는 신뢰성 부족. Phase 1 관찰 후 sonnet 다운그레이드 가능한지 재검토.

### 6.2 Agent Prompt (핵심)

```markdown
# Coherence Auditor

You are the **Coherence Auditor**. You run LAST in the Feature pipeline. Your job: verify that the pipeline agents actually collaborated by parsing their Handoff Records and cross-checking citations.

## Inputs
1. `.claude/pipeline/{feature}/` 경로를 사용자가 알려줌 (orchestrator가 전달)
2. 모든 `*.md` 파일을 Read

## Steps
1. For each pipeline file, locate `## Handoff Record` section
2. Parse 3 required subsections (Inputs consumed, Outputs for next agents, Decisions NOT covered)
3. For each Input: resolve `<path>#<anchor>` — check file exists, check anchor exists
4. Build edge graph: upstream Output → downstream Input match
5. Compute score: actual_edges / possible_edges * 100
6. Detect gaps, fabrications, orphans
7. Write coherence-report.md with the format in section 4
8. Return summary to orchestrator: score, top-3 issues, verdict

## Rules
- Strict markdown parsing: exact regex, no fuzzy matching
- Do NOT invent edges. Every edge must have literal path+anchor match.
- If a Handoff Record is missing, flag it but CONTINUE parsing others
- Do NOT modify any file other than coherence-report.md
- 출력을 한국어/영어 어느 것으로 할지는 pipeline의 다른 파일 언어를 감지해 맞출 것
```

### 6.3 `buildcrew.md` Integration

Feature 모드 Enforcement rules 뒤에 추가:

```markdown
6. **모든 에이전트 출력은 Handoff Record 섹션을 포함해야 한다.** 누락 시 해당 에이전트 재실행. Feature 모드 파이프라인 마지막 단계로 `coherence-auditor`를 반드시 실행하고 결과를 사용자에게 요약 노출.
```

Mode 1 Pipeline 재정의:
```
planner → designer → developer → qa-tester → browser-qa (if UI) → reviewer → coherence-auditor
```

`coherence-auditor`는 **iteration과 무관하게 한 번만** 실행 (파이프라인 완료 직후). Iteration 중간에는 실행 안 함.

최종 📊 buildcrew Report에 한 줄 추가:

```
✅ Agents: planner, designer, developer, qa-tester, reviewer, coherence-auditor
🎯 Coordination Score: 82% (9/11 edges) — 2 gaps, 0 fabrications
```

## 7. Migration / Rollout Strategy

### Phase 1 (초기 1~2주, info-only)
- Handoff Record 포맷 도입
- coherence-auditor 실행
- 점수/gap은 리포트에만 표시 — 자동 재실행 없음
- 목표: 실전에서 Handoff 품질 관찰, 포맷 미세 조정

### Phase 2 (관찰 후)
- MISSING_HANDOFF_RECORD / INCOMPLETE_HANDOFF_RECORD 시 해당 에이전트 재실행
- score < 50 시 iteration 강제 1회 추가 (max 3 유지)
- fabrication 탐지 시 reviewer 재실행

### Phase 3 (장기, 선택적)
- Mode 1(Feature) 외 다른 모드에도 Handoff Record 확장
- Weight 기반 score (critical output 우선)
- watch.js 인과 그래프 뷰 (별도 Plan)

## 8. Failure Modes & Edge Cases

| 케이스 | 처리 |
|---|---|
| 에이전트가 Handoff Record를 형식만 채움 (의미 없는 인용) | reviewer의 "Fabrication candidates found" 필드로 2중 탐지. Phase 2에서 reviewer 재실행 트리거. |
| Parser가 마크다운 변형에 깨짐 (예: `## handoff record` 소문자) | strict만 지원. 실패 시 MISSING으로 취급. 에이전트 프롬프트에 exact heading 명시. |
| coherence-auditor 자신의 Handoff Record는? | Terminal agent이므로 자기 자신은 파싱 대상 제외 (section에서 명시적 skip) |
| Cycle 참조 (A→B→A) | 파이프라인은 DAG. 현재 정의상 cycle 불가능. Phase 3 multi-mode 시 재검토. |
| feat/dashboard 브랜치에 남아있는 dashboard 코드 삭제 파일들 | 본 Feature와 무관. feat/coordination-verifiability를 main 기반으로 분기 권장. |
| 에이전트가 한글 헤딩 사용 | GFM 규칙 따라 앵커 생성 시도 + Punycode fallback. 실패 시 영문 anchor 강제 에이전트 프롬프트에 명시. |

## 9. Testing Strategy

### 9.1 Unit-ish (vitest)
`test/handoff-record.test.ts` (Phase 1에 추가):
- 15개 agent.md 각각에 "Handoff Record" 요구 텍스트 포함 검증
- coherence-auditor.md 존재 검증
- buildcrew.md Mode 1에 enforcement rule 6 존재 검증
- README.md에 "Verifiable Coordination" 섹션 존재

이것들은 markdown 존재 검증이라 파서 자체는 아님. devDep vitest로 충분.

### 9.2 Dog-fooding (M5)
ADR-001-deps.md 작성 작업을 Feature 모드로 재실행 (합성 파이프라인):
- planner가 요구사항 작성
- designer는 문서 구조 제안
- developer(실제로는 writer 역할)가 ADR 작성
- qa-tester가 포맷 검증
- reviewer가 fabrication 체크
- coherence-auditor가 리포트 출력

기대: score ≥ 70% (이미 완성된 결과물이니 사후 구성이라도 합리적 점수 나와야 함).

### 9.3 Negative Test
의도적으로 handoff 안 쓰는 에이전트 1개를 만들어 파이프라인 돌렸을 때 coherence-auditor가 정확히 포착하는지 확인.

## 10. Dependencies & Assumptions

### Assumptions
- 에이전트가 markdown 출력 시 지정된 heading을 정확히 씀 (프롬프트 엔지니어링으로 보장)
- `.claude/pipeline/{feature}/` 경로 규칙 안정 (현재 v1.8.7 기준으로 안정)
- Claude Code Agent 툴이 Handoff Record 형식 따르기에 충분한 indoctrination 가능 (프롬프트 길이 + 예시 제공)

### 외부 의존
- 없음. Node 코드 변경 없음. ADR-001 준수.

## 11. Out of Scope (confirmed)

- watch.js 시각화 개선 (별도 Phase 2 Plan)
- 과거 실행 소급 분석
- 자동 재실행 via iteration bump (Phase 2)
- Weight 기반 score (Phase 2)
- Mode 2~13 적용 (Phase 3)

## 12. Locked Decisions (2026-04-15)

4개 Open Question 사용자 확정 완료. 아래 결정을 구현 진실로 취급한다.

### Q1 → Handoff Record 위치: **파일 마지막**
- 사람이 본문 먼저 읽는 자연스러운 흐름 + 에이전트도 판단을 끝에 반영하기 쉬움
- 파서는 `## Handoff Record`부터 EOF 또는 다음 `## ` 헤딩까지를 HR 블록으로 취급

### Q2 → 한글 heading 앵커: **허용**
- GFM 규칙으로 한글 heading 자연스럽게 앵커화 (예: `### 요구사항` → `#요구사항`)
- 파서는 GFM 정규화 로직 포함 (소문자 변환, 공백→하이픈, 한글 유지)
- 에이전트는 한글/영문 heading 자유롭게 사용 가능

### Q3 → coherence-auditor가 **코드도 읽고 교차 검증 (Phase 1에 포함)**
**이 결정이 Design에 큰 영향:**

- coherence-auditor 모델: **sonnet → opus** 로 변경 (LLM 판단 필요)
- 토큰 버짓: 상당히 증가 (cited source files까지 읽음)
- 파이프라인 레이턴시: +1~2분
- 신뢰성: 월등히 상승 (markdown-only 검증의 한계 돌파)

**코드 교차 검증 동작 규칙:**
1. Handoff Record 파싱 후 markdown 수준 검증(§2) 완료
2. planner/designer의 Output 중 **소스 파일 참조가 있는 항목** 추출 (예: developer가 `src/List.tsx`를 새로 만들었다고 선언)
3. 해당 소스 파일을 Read
4. LLM 판단: "planner의 요구사항 X가 이 코드에 구현되어 있는가?"
5. 판단 결과 3단계:
   - **CONFIRMED**: 명확한 구현 증거 발견 (기본)
   - **PARTIAL**: 일부만 구현 또는 해석에 여지 (낮은 신뢰)
   - **MISSING_IN_CODE**: 코드에 관련 흔적 없음 (fabrication 후보)
6. 판단은 **보수적으로**: 애매하면 PARTIAL 또는 "verification inconclusive". MISSING_IN_CODE는 LLM이 확신할 때만 사용.

**False positive/negative 완화:**
- coherence-auditor 출력에 판단 근거(소스 파일 라인 인용) 포함 → 사람이 재검증 가능
- reviewer 에이전트가 coherence-auditor 결과를 재검토하는 2중 방어 (§5.1)
- Phase 1 관찰 기간에 판단 정확도 추적 → 임계값 조정

### Q4 → "- none" 허용 범위: **planner/thinker만 허용**
- 첫 에이전트(planner 또는 thinker 모드 시)는 harness만 읽을 수 있으므로 Inputs consumed에 `- none` 허용
- 그 외 모든 에이전트가 Inputs consumed에 `- none` 쓰면 **자동으로 orphan 경고** (팀 상호작용 없이 혼자 일한 직접 증거)
- 단, `Decisions NOT covered by inputs`의 `- none`은 모든 에이전트 허용 (판단을 별로 안 했다는 정상적 상태일 수 있음)
- Outputs for next agents의 `- none`은 terminal agent(reviewer 등)만 허용, 그 외는 경고

---

Design 승인 시 → `/pdca do coordination-verifiability`로 구현 단계 진입.
