# claude-constitution

11 specialized AI agents for Claude Code — auto-orchestrated team with 9 operating modes.

One command installs a virtual engineering team into any project.

## Install

```bash
npx claude-constitution
```

This copies 11 agent files to `.claude/agents/` in your project.

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) (for browser-qa and canary-monitor)

## Agents

### Build Team
| Agent | Role |
|-------|------|
| `planner` | Requirements, user stories, acceptance criteria |
| `designer` | UI/UX specs + HTML/CSS prototypes |
| `developer` | Implementation |

### Quality Team
| Agent | Role |
|-------|------|
| `qa-tester` | Code-level verification (types, lint, build) |
| `browser-qa` | Real browser testing via Playwright MCP |
| `reviewer` | Multi-specialist code review + auto-fix |
| `health-checker` | Code quality dashboard (0-10 score) |

### Security & Ops
| Agent | Role |
|-------|------|
| `security-auditor` | OWASP Top 10 + STRIDE threat model |
| `canary-monitor` | Post-deploy production health |
| `shipper` | Release pipeline (test → version → PR) |

### Specialist
| Agent | Role |
|-------|------|
| `investigator` | Root cause debugging (4-phase, edit-frozen) |

## 9 Operating Modes

All orchestrated by `constitution` — just describe what you need and it routes to the right agents.

```
@constitution Add user dashboard          → Feature Mode (Plan→Design→Dev→QA→BrowserQA→Review)
@constitution full project audit          → Audit Mode (Scan→Prioritize→Fix→Verify)
@constitution browser qa localhost:3000   → Browser QA Mode (Playwright testing)
@constitution security audit              → Security Mode (OWASP + STRIDE)
@constitution debug: login broken         → Debug Mode (4-phase investigation)
@constitution health check                → Health Mode (quality dashboard)
@constitution canary https://myapp.com    → Canary Mode (production monitoring)
@constitution code review                 → Review Mode (multi-specialist)
@constitution ship                        → Ship Mode (test→version→changelog→PR)
```

## Feature Pipeline

Each feature generates a full document chain:

```
.claude/pipeline/{feature}/
├── 01-plan.md           Planner output
├── 02-design.md         Designer spec
├── 02-prototype.html    Working HTML prototype
├── 03-dev-notes.md      Developer output
├── 04-qa-report.md      QA verification
├── 05-browser-qa.md     Browser test results
├── 06-review.md         Code review findings
└── 07-ship.md           Release report + PR URL
```

## CLI Options

```bash
npx claude-constitution              # Install agents
npx claude-constitution --force      # Overwrite existing
npx claude-constitution --list       # List agents
npx claude-constitution --uninstall  # Remove agents
npx claude-constitution --help       # Help
```

## How It Works

- Each agent is a `.md` file in `.claude/agents/` that Claude Code reads as instructions
- `constitution.md` orchestrates all agents, auto-detecting the mode from your request
- Agents hand off to each other via structured documents in `.claude/pipeline/`
- Quality gates route back to the right agent when issues are found
- No external dependencies — just Markdown files that Claude Code understands

## License

MIT
