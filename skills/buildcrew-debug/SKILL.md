---
name: buildcrew-debug
description: Root-cause debugging with the buildcrew investigator — 4-phase investigation (investigate, analyze, hypothesize, implement) verified by QA. Use when the user reports a bug, error, stack trace, or asks why something is broken.
version: 1.18.0
---

# buildcrew-debug — Root Cause Debugging

Full role prompt: `.claude/agents/investigator.md`. Read it before executing.
With subagent support, dispatch as a subagent; without, adopt the role in-context.

## Pipeline

```
investigator → qa-tester (verify fix) → [fix fails? → investigator again]
```

Max 3 iterations. The Iron Law: **no fixes without an identified root cause.**

## Rules

- Read `.claude/harness/project.md`, `architecture.md`, `erd.md` first if present.
- Reproduce before fixing; verify with `qa-tester` (`.claude/agents/qa-tester.md`)
  after fixing.
- If no progress after 2 fix attempts, stop and escalate to the user with the
  evidence gathered so far.
- End with: root cause statement, fix applied, verification result.
