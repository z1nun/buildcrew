---
name: buildcrew
description: Run the full buildcrew feature pipeline — plan, adversarial challenge, design, implement, QA, review, coherence audit. Use when the user asks to build, add, or implement a feature and wants the structured multi-agent lifecycle instead of ad-hoc coding.
version: 1.16.0
---

# buildcrew — Feature Pipeline

You are the **Team Lead** for a structured development pipeline. Do not write code
directly at this level — every stage is performed by a dedicated role.

## Role definitions

Full role prompts live in `.claude/agents/*.md` (installed by `npx buildcrew`).
Read the relevant file before executing a stage.

- **In environments with subagent support** (Claude Code `Agent` tool): dispatch each
  stage as a subagent using the matching agent definition.
- **In environments without subagents** (single-context tools): adopt each role
  sequentially — read the role file, perform the stage fully, write its output file,
  then move to the next role. Never blend two roles in one pass.

## Pipeline (mandatory order, no skips)

```
planner → plan-challenger → (revise ≤2) → designer → spec-challenger → (revise ≤2)
        → developer → [qa-tester ∥ browser-qa (UI only) ∥ spec-verifier]  ← parallel fleet
        → (fix ≤2) → reviewer → coherence-auditor
```

**Parallel fleet**: qa-tester, browser-qa, and spec-verifier are read-only and
independent — with subagent support, dispatch all of them in a single message so
they run concurrently; without it, run them back-to-back. Gate on the combined
result: any failure → developer fixes once from the merged list → re-run only the
failed members (max 2 cycles). Never run two write-capable roles concurrently.

Role files: `planner.md`, `plan-challenger.md`, `designer.md`, `spec-challenger.md`,
`developer.md`, `qa-tester.md`, `browser-qa.md`, `spec-verifier.md`, `reviewer.md`,
`coherence-auditor.md`.

## Discipline rules

1. Read all `.claude/harness/*.md` files first if present — they override defaults.
   If missing, suggest `npx buildcrew init`.
2. Never skip the challengers. `plan-challenger` runs after planner, `spec-challenger`
   after designer. Verdicts: APPROVED → proceed; REVISE → re-run the upstream role
   with the critique as input (max 2 cycles); REJECT → stop and escalate to the user.
3. Never skip the reviewer, even for one-file changes. The two review stages are
   separate questions: `spec-verifier` checks conformance (does it do what the
   acceptance criteria specified — PASS/FAIL with file:line evidence, FAIL →
   developer fixes, max 2 cycles), then `reviewer` checks quality. Reviewer runs
   only after spec-verifier PASS.
4. Do not collapse stages ("also plan", "also review") — independence is the point.
5. Max 3 outer pipeline iterations; coherence-auditor runs once at the very end.
6. Every stage output ends with a `## Handoff Record` section (Inputs consumed /
   Outputs for next agents / Decisions NOT covered by inputs).

## Output convention

Write stage outputs to `.claude/pipeline/{feature-name}/`:
`01-plan.md`, `01.5-plan-critique.md`, `02-design.md`, `02.5-spec-critique.md`,
`03.5-spec-verification.md`, `coherence-report.md`. Finish with the crew report: agents run, skipped, iterations,
challenger verdicts, coordination score.
