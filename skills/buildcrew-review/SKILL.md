---
name: buildcrew-review
description: Review with buildcrew reviewer roles — code review with auto-fix, pre-code architecture review, or UX/design review with 0-10 scoring. Use when the user asks for a code review, PR review, architecture review, or design/UX review.
version: 1.17.0
---

# buildcrew-review — Review Modes

Pick the sub-mode from the user's intent. Full role prompts live in
`.claude/agents/*.md`; read the role file before executing. With subagent support,
dispatch it as a subagent; without, adopt the role in-context.

## Sub-modes

| Intent | Role file | Loop |
|---|---|---|
| "code review", "PR review" | `reviewer.md` | changes requested → `developer.md` → re-review (max 2) |
| "architecture review" (before code) | `architect.md` | REVISE verdict → `developer.md` → re-review (max 2) |
| "design review", "UX review" | `design-reviewer.md` | score < 7 → `developer.md` → re-review (max 2) |

## Rules

- Read all `.claude/harness/*.md` files first if present.
- Fixes are made by the `developer` role, never inline by the reviewer —
  reviewer independence is the point.
- Findings need file:line references and concrete suggestions, ranked by severity.
- End with: verdict/score, issues found, fixed vs remaining.
