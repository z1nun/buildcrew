# buildcrew

> **English** | [한국어](README.ko.md)

11 AI agents for Claude Code — auto-orchestrated dev team with 9 operating modes.

```bash
npx buildcrew
```

---

## Why buildcrew?

AI coding agents are powerful, but without structure they produce inconsistent results. buildcrew gives Claude Code:

- **A team** — 11 specialized agents, each with a clear role
- **A process** — sequential pipeline with quality gates and iteration
- **A harness** — your project context, rules, and domain knowledge baked in
- **An orchestrator** — just talk to `@constitution`, it routes automatically

```
You:   @constitution Add user authentication
Crew:  Planner → Designer → Developer → QA → Browser QA → Reviewer → Ship
```

No external dependencies. No runtime. No binaries. Just Markdown.

---

## Getting Started

```bash
# 1. Install agents
npx buildcrew

# 2. Set up project harness (interactive)
npx buildcrew init

# 3. Add more context (optional)
npx buildcrew add erd
npx buildcrew add architecture
npx buildcrew add design-system

# 4. Start working
@constitution Add user dashboard
```

---

## Harness Engineering

The harness is what separates "generic AI output" from "code that fits your project."

```bash
npx buildcrew init
```

Interactive setup creates core harness files:

```
[1/3] Project Context
  Project name, description, tech stack (auto-detected), deploy target, production URL

[2/3] Team Rules
  Coding conventions, priorities, what to avoid, quality standards, review rules

[3/3] Domain Knowledge
  Industry, user types, domain terms, business rules
```

### Add more context with templates

```bash
npx buildcrew add erd              # Database schema & relationships
npx buildcrew add architecture     # System architecture overview
npx buildcrew add api-spec         # API endpoints & contracts
npx buildcrew add design-system    # Colors, typography, components
npx buildcrew add glossary         # Domain terms & user roles
npx buildcrew add user-flow        # User journeys & page map
npx buildcrew add env-vars         # Environment variables guide
```

### The harness is open

Not limited to templates. Create any `.md` file in `.claude/harness/`:

```
.claude/harness/
├── project.md          ← core (auto by init)
├── rules.md            ← core (auto by init)
├── erd.md              ← template
├── architecture.md     ← template
├── design-system.md    ← template
├── glossary.md         ← template
├── my-custom-notes.md  ← your own file (agents read it too)
└── anything.md         ← any .md file works
```

All agents read harness files before every task. Constitution routes the right files to the right agents:

| File | Routed to |
|------|-----------|
| `project.md`, `rules.md` | All agents |
| `erd.md`, `architecture.md`, `api-spec.md` | developer, reviewer, security-auditor, investigator |
| `design-system.md` | designer |
| `glossary.md`, `user-flow.md` | planner, designer, browser-qa |
| `env-vars.md` | developer, security-auditor |
| Custom files | reviewer, security-auditor (read ALL) |

### Manage the harness

```bash
npx buildcrew harness          # Show status of all harness files
npx buildcrew add              # List available templates
npx buildcrew add erd          # Add a specific template
npx buildcrew init --force     # Regenerate core files from scratch
```

---

## Agents

### Build Team

| Agent | Model | Role |
|-------|-------|------|
| **planner** | opus | 6 Forcing Questions + 4-Lens Self-Review (CEO, Engineering, Design, QA). Produces battle-tested plans scored 1-10 per lens. |
| **designer** | opus | Searches web for UI/UX references, screenshots real sites with Playwright, integrates Figma MCP, writes production React/Next.js components. AI slop blacklist enforced. |
| **developer** | sonnet | Implements features following plan + design + harness conventions. Self-reviews before handoff. |

### Quality Team

| Agent | Model | Role |
|-------|-------|------|
| **qa-tester** | sonnet | Code-level verification — types, lint, build, acceptance criteria check. |
| **browser-qa** | sonnet | Real browser testing via Playwright MCP — user flows, responsive (375/768/1440px), console errors, network, health score (0-100). |
| **reviewer** | opus | 4-specialist parallel review (security, performance, testing, maintainability) + adversarial pass + auto-fix. Fix-first approach. |
| **health-checker** | sonnet | Code quality dashboard — 7-category weighted score (0-10), trend tracking, top 5 actionable items. |

### Security & Ops

| Agent | Model | Role |
|-------|-------|------|
| **security-auditor** | opus | OWASP Top 10 + STRIDE threat model. 10-phase audit. Secrets scan, dependency audit, AI/LLM security. Confidence gate (8/10 standard, 2/10 comprehensive). |
| **canary-monitor** | sonnet | Post-deploy health — page availability, API status, console errors, performance vs baseline. |
| **shipper** | sonnet | Release pipeline — pre-flight checks → version bump → changelog → commit → push → PR creation. |

### Specialist

| Agent | Model | Role |
|-------|-------|------|
| **investigator** | sonnet | Root cause debugging. 4 phases: investigate → hypothesize → test → fix. Edit freeze on unrelated code. "No fix without root cause." |

---

## 9 Operating Modes

Talk to `@constitution` naturally. It auto-detects the mode.

| Mode | Example | What happens |
|------|---------|-------------|
| **Feature** | "Add user dashboard" | Plan → Design → Dev → QA → Browser QA → Review |
| **Project Audit** | "full project audit" | Scan → Prioritize → Fix → Verify (loop) |
| **Browser QA** | "browser qa localhost:3000" | Playwright tests flows, responsive, console |
| **Security** | "security audit" | OWASP + STRIDE + secrets + deps |
| **Debug** | "debug: login broken" | 4-phase root cause investigation |
| **Health** | "health check" | Quality dashboard (types, lint, deps, i18n) |
| **Canary** | "canary https://myapp.com" | Post-deploy production monitoring |
| **Review** | "code review" | Multi-specialist analysis + auto-fix |
| **Ship** | "ship" | Test → version → changelog → PR |

### Mode chaining

Constitution auto-suggests the next mode:
- Feature complete → Ship
- Ship complete → Canary
- Canary CRITICAL → Debug

---

## Feature Pipeline

Each feature generates a full document chain:

```
.claude/pipeline/{feature}/
├── 01-plan.md           Requirements + 4-lens review scores
├── 02-references.md     Curated UI/UX references from real sites
├── 02-design.md         Design decisions + component specs
├── 03-dev-notes.md      Implementation notes + files changed
├── 04-qa-report.md      Acceptance criteria verification
├── 05-browser-qa.md     Health score + screenshots + flow results
├── 06-review.md         Review findings + auto-fixes applied
└── 07-ship.md           PR URL + release notes
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `npx buildcrew` | Install 11 agents to `.claude/agents/` |
| `npx buildcrew init` | Set up project harness (interactive) |
| `npx buildcrew init --force` | Regenerate harness from scratch |
| `npx buildcrew add` | List available harness templates |
| `npx buildcrew add <type>` | Add a harness template (erd, architecture, etc.) |
| `npx buildcrew harness` | Show status of all harness files |
| `npx buildcrew --force` | Overwrite existing agent files |
| `npx buildcrew --list` | List all agents with models |
| `npx buildcrew --uninstall` | Remove installed agents |
| `npx buildcrew --version` | Show version |

## Requirements

- **Required**: [Claude Code](https://claude.ai/code) CLI
- **Optional**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — for browser-qa, canary-monitor, designer
- **Optional**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — for designer

```bash
# Enable real browser testing
claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright
```

## Customization

Every file is editable:

```
.claude/agents/      Agent definitions — edit roles, tools, instructions, model
.claude/harness/     Project context — edit anytime, add any .md file
.claude/pipeline/    Output documents — auto-generated per feature
```

Change an agent's model:
```yaml
# In any agent .md file
model: opus    # or sonnet, haiku
```

## Architecture

```
@constitution (orchestrator, opus)
    │
    ├─ reads .claude/harness/*.md (project context)
    │
    ├─ detects mode from user message
    │
    ├─ dispatches agents with relevant harness context
    │
    └─ enforces quality gates + iteration
         │
         ├── Build:    planner → designer → developer
         ├── Quality:  qa-tester → browser-qa → reviewer
         ├── Sec/Ops:  security-auditor, canary-monitor, shipper
         └── Debug:    investigator
```

## License

MIT
