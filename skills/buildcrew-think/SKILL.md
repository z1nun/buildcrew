---
name: buildcrew-think
description: Product thinking with the buildcrew thinker — 6 forcing questions that test whether something is worth building, ending in a design doc. Use when the user has a product idea, asks "is this worth building", or wants to think a concept through before code.
version: 1.16.0
---

# buildcrew-think — Product Thinking

Full role prompt: `.claude/agents/thinker.md`. Read it before executing.
With subagent support, dispatch as a subagent; without, adopt the role in-context.

## Pipeline

```
thinker (single run, interactive with the user)
```

This mode is a conversation, not a monologue — ask the forcing questions one at a
time and build on the user's answers.

## Rules

- Read `.claude/harness/project.md` and `glossary.md` first if present.
- Do not write implementation code in this mode. The deliverable is a design doc.
- If the conclusion is "worth building", offer to continue into the feature
  pipeline (`buildcrew` skill / `@buildcrew`).
- End with: verdict (build / don't build / reshape), the design doc, and open
  questions that remain.
