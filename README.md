# buildcrew

11 AI agents for Claude Code — auto-orchestrated dev team with 9 operating modes.

One command. A full engineering team in your project.

```bash
npx buildcrew
```

## What It Does

`buildcrew` installs 11 specialized AI agent definitions into your project's `.claude/agents/` directory. A **constitution** agent orchestrates them all — just describe what you need, and it routes to the right agents automatically.

```
You:   @constitution Add a user dashboard
Crew:  Planner → Designer → Developer → QA → Browser QA → Reviewer → ✅
```

No external dependencies. No runtime. Just Markdown files that Claude Code understands.

## Requirements

- [Claude Code](https://claude.ai/code) CLI
- [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) _(optional, for browser-qa & canary-monitor)_

```bash
# Optional: enable real browser testing
claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright
```

## Agents

### Build Team
| Agent | What it does |
|-------|-------------|
| **planner** | Requirements, user stories, acceptance criteria |
| **designer** | UI/UX specs + working HTML/CSS prototypes |
| **developer** | Implementation following plan & design |

### Quality Team
| Agent | What it does |
|-------|-------------|
| **qa-tester** | Code-level verification — types, lint, build |
| **browser-qa** | Real browser testing via Playwright MCP |
| **reviewer** | Multi-specialist code review (security, perf, testing, maintainability) + auto-fix |
| **health-checker** | Code quality dashboard — weighted 0-10 score |

### Security & Ops
| Agent | What it does |
|-------|-------------|
| **security-auditor** | OWASP Top 10 + STRIDE threat model |
| **canary-monitor** | Post-deploy production health check |
| **shipper** | Release pipeline — test → version → changelog → PR |

### Specialist
| Agent | What it does |
|-------|-------------|
| **investigator** | Root cause debugging — 4-phase, edit-frozen |

## 9 Operating Modes

Just talk to `@constitution` naturally. It auto-detects the mode.

| Mode | Trigger | What happens |
|------|---------|-------------|
| **Feature** | _"Add user dashboard"_ | Plan → Design → Dev → QA → Browser QA → Review |
| **Project Audit** | _"full project audit"_ | Scan → Prioritize → Fix → Verify |
| **Browser QA** | _"browser qa localhost:3000"_ | Playwright tests all flows, responsive, console |
| **Security** | _"security audit"_ | OWASP + STRIDE + secrets + dependency scan |
| **Debug** | _"debug: login broken"_ | 4-phase root cause investigation |
| **Health** | _"health check"_ | Quality dashboard (types, lint, build, deps, i18n) |
| **Canary** | _"canary https://myapp.com"_ | Post-deploy production monitoring |
| **Review** | _"code review"_ | Multi-specialist analysis + adversarial + auto-fix |
| **Ship** | _"ship"_ | Test → version bump → changelog → PR |

## Feature Pipeline

Each feature generates a full document chain in `.claude/pipeline/`:

```
01-plan.md           Planner output
02-design.md         Designer spec
02-prototype.html    Working HTML prototype (open in browser!)
03-dev-notes.md      Developer output
04-qa-report.md      QA verification
05-browser-qa.md     Browser test results + health score
06-review.md         Code review findings + auto-fixes
07-ship.md           Release report + PR URL
```

## CLI

```bash
npx buildcrew              # Install agents
npx buildcrew --force      # Overwrite existing
npx buildcrew --list       # List all agents
npx buildcrew --uninstall  # Remove agents
npx buildcrew --version    # Show version
npx buildcrew --help       # Help
```

## How It Works

1. Agent files are Markdown (`.md`) with YAML frontmatter
2. Claude Code reads them from `.claude/agents/` as agent definitions
3. `constitution.md` is the orchestrator — it reads your message, picks the mode, dispatches agents
4. Agents hand off via structured documents in `.claude/pipeline/`
5. Quality gates route back when issues are found
6. No binaries, no runtime, no config — just Markdown

## Customization

Every agent is a Markdown file. Edit them to fit your project:

```bash
# After install, agents live here:
.claude/agents/
├── constitution.md      # Edit modes, triggers, team rules
├── designer.md          # Edit design system, prototype template
├── security-auditor.md  # Add project-specific security checks
└── ...
```

## Compared to gstack

| | buildcrew | gstack |
|---|-----------|--------|
| **Install** | `npx buildcrew` | `git clone` + Bun + `./setup` |
| **Orchestration** | Auto (constitution routes) | Manual (`/qa`, `/review`, ...) |
| **Dependencies** | None | Bun, Playwright binary (~58MB) |
| **Browser testing** | Playwright MCP | Custom Playwright daemon |
| **Pipeline docs** | Auto-generated chain (01-07) | Per-skill output (no chain) |
| **Agents** | 11 | 34 |
| **Customization** | Edit .md directly | Edit .md (may be overwritten on update) |

## License

MIT
