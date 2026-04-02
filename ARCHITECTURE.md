# Architecture

## Overview

buildcrew is a set of 12 Markdown agent definitions that Claude Code reads as instructions. There is no runtime, no binary, no server — just structured prompts.

```
npx buildcrew
    │
    ▼
Copies 12 .md files to .claude/agents/
    │
    ▼
Claude Code discovers agents automatically
    │
    ▼
User talks to @buildcrew → routes to the right agents
```

## Agent System

### How Agents Work in Claude Code

Claude Code looks for agent definitions in `.claude/agents/*.md`. Each file has:

```yaml
---
name: agent-name          # How to invoke: @agent-name
description: ...          # What it does
model: sonnet             # Which model to use
tools:                    # Which tools the agent can use
  - Read
  - Write
  - Bash
---

# Agent instructions in Markdown
```

When a user types `@agent-name [message]`, Claude Code loads the Markdown as system instructions and gives the agent access to the listed tools.

### Orchestrator Pattern

The key design decision is the **orchestrator pattern**: one lead agent (`buildcrew`) that dispatches to specialist agents based on the user's intent.

```
User message
    │
    ▼
┌──────────────┐
│  BUILDCREW   │ ← Reads message, detects mode, dispatches agents
└──────┬───────┘
       │
       ├── Mode 1 (Feature)  → planner → designer → developer → qa-tester → browser-qa → reviewer
       ├── Mode 2 (Audit)    → planner(discovery) → [designer →] developer → qa-tester (loop)
       ├── Mode 3 (BrowserQA) → browser-qa [→ developer → browser-qa]
       ├── Mode 4 (Security)  → security-auditor [→ developer → security-auditor]
       ├── Mode 5 (Debug)     → investigator → qa-tester
       ├── Mode 6 (Health)    → health-checker
       ├── Mode 7 (Canary)    → canary-monitor
       ├── Mode 8 (Review)    → reviewer [→ developer → reviewer]
       └── Mode 9 (Ship)      → shipper
```

The orchestrator auto-detects intent and chains agents — no manual skill invocation needed.

### Agent Categories

```
Build Team (create)        Quality Team (verify)       Security & Ops (protect & ship)
┌──────────┐               ┌─────────────┐             ┌───────────────┐
│ planner  │──────────────▶│ qa-tester   │             │ security-     │
│ designer │               │ browser-qa  │             │   auditor     │
│ developer│◀──────────────│ reviewer    │             │ canary-monitor│
│          │               │ health-     │             │ shipper       │
│          │               │   checker   │             │               │
└──────────┘               └─────────────┘             └───────────────┘
                                                       
Specialist
┌──────────────┐
│ investigator │  (standalone — called by buildcrew for bug investigation)
└──────────────┘
```

## Pipeline System

Agents communicate via files in `.claude/pipeline/`. Each mode creates its own subdirectory:

```
.claude/pipeline/
├── {feature-name}/            Feature mode (sequential chain)
│   ├── 01-plan.md             ← planner output
│   ├── 02-design.md           ← designer output (spec)
│   ├── 02-prototype.html      ← designer output (interactive)
│   ├── 03-dev-notes.md        ← developer output
│   ├── 04-qa-report.md        ← qa-tester output
│   ├── 05-browser-qa.md       ← browser-qa output
│   ├── 06-review.md           ← reviewer output
│   ├── 07-ship.md             ← shipper output
│   └── iteration-log.md       ← buildcrew tracking
│
├── project-audit/             Audit mode
│   ├── 00-backlog.md
│   └── iteration-N/
│
├── security-audit/            Security mode
│   └── security-audit.md
│
├── health/                    Health mode
│   └── health-report.md
│
├── canary/                    Canary mode
│   └── canary-report.md
│
├── browser-qa/                Browser QA mode (standalone)
│   └── browser-qa-report.md
│
├── review/                    Review mode (standalone)
│   └── review-report.md
│
└── debug-{bug}/               Debug mode
    └── investigation.md
```

### Handoff Protocol

Each agent:
1. Reads the previous agent's output file
2. Does its work
3. Writes its own output file
4. The next agent reads that file

This creates an auditable chain where every decision is documented.

## Quality Gates

The orchestrator implements quality gates after QA phases:

```
QA Result
    │
    ├── ALL PASS → proceed to next agent (or complete)
    │
    └── FAIL → route back to responsible agent
               ├── UI issue → designer
               ├── Code bug → developer
               └── Spec unclear → planner
```

After max iterations (configurable), ship with known issues documented.

## Iteration Control

Each mode has a default max iteration count:

| Mode | Default | What iterates |
|------|---------|--------------|
| Feature | 3 | QA fail → fix → re-QA |
| Audit | 2 | Scan → fix → re-scan |
| Browser QA | 2 | Test → fix → re-test |
| Security | 2 | Audit → fix → re-audit |
| Debug | 3 | Hypothesis → test → new hypothesis |
| Review | 2 | Review → fix → re-review |
| Health/Canary/Ship | 1 | No iteration |

## Design Decisions

### Why Markdown, not code?

- Zero dependencies — nothing to install, build, or break
- Transparent — users can read and modify agent behavior
- Portable — works on any OS where Claude Code runs
- Versionable — git tracks changes to agent behavior over time

### Why a single orchestrator?

- Users don't need to know which agent to invoke
- Mode detection from natural language is reliable
- Enables automatic chaining (Feature → Ship, Canary → Debug)
- Single entry point reduces cognitive load

### Why Playwright MCP instead of a custom binary?

- Already available in the Claude Code ecosystem
- No build step, no Bun dependency
- Same capabilities (~100ms per command, persistent browser)
- Users may already have it installed

### Why numbered pipeline files?

- Clear execution order
- Easy to find specific phase output
- Agents know exactly which file to read/write
- Git-friendly — you can commit pipeline docs as project history
