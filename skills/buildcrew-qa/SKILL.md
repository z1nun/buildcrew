---
name: buildcrew-qa
description: QA a project with buildcrew quality roles — browser QA via Playwright, 3-lens QA audit on git diffs, or a 0-10 code health score. Use when the user asks to test the site, audit code quality, run QA, or get a health check.
version: 1.15.0
---

# buildcrew-qa — Quality Modes

Pick the sub-mode from the user's intent. Full role prompts live in
`.claude/agents/*.md`; read the role file before executing. With subagent support,
dispatch it as a subagent; without, adopt the role in-context.

## Sub-modes

| Intent | Role file | Loop |
|---|---|---|
| "browser test", "UI test", live-site QA | `browser-qa.md` | if score < 70 → `developer.md` fixes → re-run browser-qa (max 2) |
| "qa audit", "audit my code", diff inspection | `qa-auditor.md` | 1 run (3 parallel lenses where supported) |
| "health check", "quality score" | `health-checker.md` | 1 run, report only |

## Rules

- Read `.claude/harness/project.md` and `rules.md` first if present.
- browser-qa requires Playwright MCP; if unavailable, stop and instruct:
  `claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright`.
- Fixes are made by the `developer` role, never inline by the QA role.
- End with a scored report and the list of issues found/fixed/remaining.
