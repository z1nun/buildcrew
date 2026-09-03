---
name: buildcrew-ship
description: Ship with the buildcrew shipper — pre-flight tests, version bump, changelog, commit, push, PR creation. Use when the user asks to ship, release, deploy, push, or create a PR.
version: 1.15.0
---

# buildcrew-ship — Release Workflow

Full role prompt: `.claude/agents/shipper.md`. Read it before executing.
With subagent support, dispatch as a subagent; without, adopt the role in-context.

## Pipeline

```
shipper (single run): pre-flight tests → version bump → changelog → commit → push → PR
```

If pre-flight fails, **stop immediately** and suggest running qa-tester
(`.claude/agents/qa-tester.md`). Never ship over failing tests.

## Rules

- Read `.claude/harness/project.md` and `rules.md` first if present.
- Use `gh` CLI for PR creation when available; otherwise output the PR title/body
  for manual creation.
- Never force-push, never push directly to the default branch unless the project's
  workflow explicitly says so.
- End with: version shipped, PR link (or body), changelog entry.
