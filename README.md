# buildcrew

11 AI agents for Claude Code — auto-orchestrated dev team with 9 operating modes.

One command. A full engineering team in your project.

```bash
npx buildcrew
```

---

## Why buildcrew?

AI coding agents are powerful, but without structure they produce inconsistent results. buildcrew gives Claude Code:

- **A team** — 11 specialized agents, each with a clear role
- **A process** — sequential pipeline with quality gates and iteration
- **A harness** — your project context, rules, and domain knowledge baked into every agent's instructions
- **An orchestrator** — just talk to `@constitution`, it routes to the right agents

```
You:   @constitution Add user authentication
Crew:  Planner → Designer → Developer → QA → Browser QA → Reviewer → Ship
```

No external dependencies. No runtime. No binaries. Just Markdown.

---

## Getting Started

### Step 1: Install agents

```bash
npx buildcrew
```

Copies 11 agent `.md` files to `.claude/agents/`.

### Step 2: Set up your project harness

```bash
npx buildcrew init
```

Interactive setup that creates your project's **harness** — the context, rules, and domain knowledge that makes agents work for YOUR project specifically.

```
[1/3] Project Context
  Project name: my-saas-app
  What does this project do?: B2B analytics dashboard
  Tech stack (detected: Next.js, TypeScript, TailwindCSS, Supabase)
  Deploy target: Vercel
  Production URL: https://app.example.com

[2/3] Team Rules (Constitution)
  Coding conventions: functional components only, no default exports
  What to prioritize: UX over performance, ship fast
  What to avoid: no any types, no lodash
  Quality standards: all code must pass tsc, 100% i18n coverage
  Review rules: always check auth on API routes, mobile-first

[3/3] Domain Knowledge
  Domain: B2B SaaS, analytics
  User types: free users, pro users, team admins
  Key domain terms: workspace=team account, widget=dashboard component
  Business rules: free users limited to 3 widgets, pro gets unlimited
```

This creates the core harness files. Then add more context:

```bash
# Add templates for specific areas
npx buildcrew add erd              # Database schema
npx buildcrew add architecture     # System architecture
npx buildcrew add api-spec         # API endpoints
npx buildcrew add design-system    # Colors, typography, components
npx buildcrew add glossary         # Domain terms & user roles
npx buildcrew add user-flow        # User journeys & page map
npx buildcrew add env-vars         # Environment variables

# Or create any custom .md file
echo "# My Custom Context" > .claude/harness/my-notes.md
```

Result:
```
.claude/harness/
├── project.md        ← auto (init)
├── rules.md          ← auto (init)
├── erd.md            ← template (add)
├── architecture.md   ← template (add)
├── design-system.md  ← template (add)
├── glossary.md       ← template (add)
└── anything.md       ← custom (you create)
```

**Every agent reads these files before starting any task.** Add, edit, remove anytime.

### Step 3: Start working

```bash
@constitution Add widget drag-and-drop reordering
```

That's it. Constitution detects the mode, dispatches agents, enforces your rules.

---

## Harness Engineering

The harness is what makes buildcrew work for your project instead of producing generic code.

- **Without harness**: "Here's a React component" (generic)
- **With harness**: "Here's a functional component using your design tokens, following your naming convention, with Korean i18n keys, tested against your business rules"

### Harness file → Agent mapping

| File | Who reads it |
|------|-------------|
| `project.md` | All agents |
| `rules.md` | All agents |
| `erd.md` | developer, investigator, reviewer, security-auditor |
| `architecture.md` | developer, investigator, reviewer |
| `api-spec.md` | developer, reviewer, security-auditor |
| `design-system.md` | designer |
| `glossary.md` | planner, designer |
| `user-flow.md` | planner, designer, browser-qa, canary-monitor |
| `env-vars.md` | developer, security-auditor |
| `*.md` (custom) | reviewer, security-auditor (read ALL) |

### The harness is open

You are **not limited to templates**. Create any `.md` file in `.claude/harness/`:

```bash
# Custom files — agents read them all
.claude/harness/competitor-analysis.md
.claude/harness/meeting-notes.md
.claude/harness/tech-debt-list.md
.claude/harness/onboarding-guide.md
```

### Managing the harness

```bash
npx buildcrew harness          # Show status of all harness files
npx buildcrew add              # List available templates
npx buildcrew add erd          # Add a specific template
npx buildcrew init --force     # Regenerate core files
```

### When to update

- Stack changes → update `architecture.md`
- New DB table → update `erd.md`
- New business rule → update `project.md` or `glossary.md`
- Bad pattern found → add to `rules.md` "What to avoid"
- New API endpoint → update `api-spec.md`

---

## Agents

### Build Team

| Agent | Model | What it does |
|-------|-------|-------------|
| **planner** | opus | 6 Forcing Questions + 4-Lens Self-Review (CEO, Engineering, Design, QA perspectives). Produces battle-tested plans. |
| **designer** | opus | Web research for UI/UX references → Playwright screenshots of real sites → Figma MCP integration → production React/Next.js components. AI slop blacklist. |
| **developer** | sonnet | Implementation following plan, design, and harness conventions. |

### Quality Team

| Agent | Model | What it does |
|-------|-------|-------------|
| **qa-tester** | sonnet | Code-level verification — types, lint, build, acceptance criteria. |
| **browser-qa** | sonnet | Real browser testing via Playwright MCP — flows, responsive, console. |
| **reviewer** | opus | Multi-specialist code review (security, performance, testing, maintainability) + auto-fix + adversarial pass. |
| **health-checker** | sonnet | Code quality dashboard — 7-category weighted 0-10 score + trends. |

### Security & Ops

| Agent | Model | What it does |
|-------|-------|-------------|
| **security-auditor** | opus | OWASP Top 10 + STRIDE threat model. 10-phase audit with confidence gate. |
| **canary-monitor** | sonnet | Post-deploy production health — pages, APIs, console, performance vs baseline. |
| **shipper** | sonnet | Release pipeline — test → version bump → changelog → PR. |

### Specialist

| Agent | Model | What it does |
|-------|-------|-------------|
| **investigator** | sonnet | Root cause debugging. 4-phase investigation. Edit freeze on unrelated code. |

---

## 9 Operating Modes

Talk to `@constitution` naturally. It auto-detects the mode.

| Mode | Trigger examples | Pipeline |
|------|-----------------|----------|
| **Feature** | "Add user dashboard" | Plan → Design → Dev → QA → Browser QA → Review |
| **Project Audit** | "full project audit" | Scan → Prioritize → Fix → Verify (loop) |
| **Browser QA** | "browser qa localhost:3000" | Playwright tests all flows + health score |
| **Security** | "security audit" | OWASP + STRIDE + secrets + deps |
| **Debug** | "debug: login broken" | 4-phase root cause → fix → verify |
| **Health** | "health check" | Quality dashboard (types, lint, deps, i18n) |
| **Canary** | "canary https://myapp.com" | Post-deploy production check |
| **Review** | "code review" | 4-specialist analysis + adversarial + auto-fix |
| **Ship** | "ship" | Test → version → changelog → PR |

### Mode chaining

Constitution auto-suggests the next mode:
- Feature complete → "Run Ship Mode?"
- Ship complete → "Run Canary Mode?"
- Canary CRITICAL → "Run Debug Mode?"

---

## Feature Pipeline

Each feature generates a full document chain:

```
.claude/pipeline/{feature}/
├── 01-plan.md           Planner: requirements + 4-lens review scores
├── 02-references.md     Designer: curated UI/UX references from real sites
├── 02-design.md         Designer: design decisions + component specs
├── 03-dev-notes.md      Developer: implementation notes + files changed
├── 04-qa-report.md      QA Tester: acceptance criteria verification
├── 05-browser-qa.md     Browser QA: health score + screenshots + flows
├── 06-review.md         Reviewer: findings + auto-fixes applied
└── 07-ship.md           Shipper: PR URL + release notes
```

Every decision is documented. Every handoff is traceable.

---

## CLI Reference

```bash
npx buildcrew                # Install 11 agents
npx buildcrew init           # Set up project harness (interactive)
npx buildcrew init --force   # Regenerate harness
npx buildcrew --force        # Overwrite existing agents
npx buildcrew --list         # List all agents with models
npx buildcrew --uninstall    # Remove agents
npx buildcrew --version      # Show version
npx buildcrew --help         # Full help
```

## Requirements

- **Required**: [Claude Code](https://claude.ai/code) CLI
- **Optional**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) for browser-qa and canary-monitor

```bash
# Enable real browser testing (optional)
claude mcp add playwright -- npx @anthropic-ai/mcp-server-playwright
```

## Customization

Every agent is a Markdown file. Edit freely:

```bash
.claude/agents/          # Agent definitions (edit roles, tools, instructions)
.claude/harness/         # Project context and rules (edit anytime)
.claude/pipeline/        # Output documents (auto-generated)
```

## Compared to gstack

| | buildcrew | gstack |
|---|-----------|--------|
| Install | `npx buildcrew` | `git clone` + Bun + `./setup` |
| Orchestration | Auto (constitution routes) | Manual (`/qa`, `/review`, ...) |
| Harness | `npx buildcrew init` (interactive) | Manual CLAUDE.md editing |
| Dependencies | None | Bun, Playwright binary (~58MB) |
| Browser testing | Playwright MCP | Custom Playwright daemon |
| Pipeline docs | Auto-generated chain (01→07) | Per-skill output (no chain) |
| Agents | 11 (5 opus + 6 sonnet) | 34 (all same model) |

## License

MIT
