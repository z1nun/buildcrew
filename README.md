# buildcrew

> **English** | [한국어](README.ko.md) | [Docs](https://buildcrew-landing.vercel.app)

11 AI agents for Claude Code — auto-orchestrated dev team with 9 operating modes.

```bash
npx buildcrew
```

---

## Why buildcrew?

AI coding agents are powerful, but without structure they produce inconsistent results. buildcrew gives Claude Code:

- **A team** — 11 specialized agents (5 opus + 6 sonnet), each with a clear role
- **A process** — sequential pipeline with quality gates and iteration
- **A harness** — your project context auto-detected from your codebase
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

# 2. Auto-generate project harness (zero questions asked)
npx buildcrew init

# 3. Customize (replace <!-- comments --> in generated files)
code .claude/harness/

# 4. Start working
@constitution Add user dashboard
```

---

## Harness Engineering

`npx buildcrew init` scans your codebase and generates a project harness — **zero questions asked**.

### What it auto-detects

| Category | Detected from |
|----------|--------------|
| Framework | package.json (Next.js, Nuxt, React, Vue, SvelteKit, Express) |
| Language | TypeScript, TailwindCSS, Framer Motion |
| Database | Supabase, Prisma, Drizzle, MongoDB |
| Auth | NextAuth, Supabase Auth, Firebase Auth |
| Payments | Stripe, Paddle, Toss Payments |
| AI | OpenAI, Anthropic, Google AI |
| Deploy | Vercel, Netlify, Fly.io, Docker |
| Components | Scans `src/components/` |
| API Routes | Scans `src/app/api/` |
| Locales | Scans i18n directories |

### What it generates

Based on detection, relevant harness files are auto-created:

```
.claude/harness/
├── project.md        ← always (project context, stack, components, API routes)
├── rules.md          ← always (smart defaults for your framework)
├── erd.md            ← if database detected
├── api-spec.md       ← if API routes found
├── design-system.md  ← if TailwindCSS detected
├── architecture.md   ← always
└── user-flow.md      ← if i18n or 5+ components
```

### Customize

Generated files use `<!-- HTML comments -->` for parts you need to fill in. Everything else is pre-filled from your codebase.

```bash
npx buildcrew harness     # Check which files need editing
```

### The harness is open

Add any `.md` file to `.claude/harness/` — agents read them all:

```bash
npx buildcrew add glossary    # Add from template
npx buildcrew add env-vars    # Add from template
echo "# Notes" > .claude/harness/my-notes.md  # Or create your own
```

### Agent routing

| File | Routed to |
|------|-----------|
| `project.md`, `rules.md` | All agents |
| `erd.md`, `architecture.md`, `api-spec.md` | developer, reviewer, security-auditor, investigator |
| `design-system.md` | designer |
| `glossary.md`, `user-flow.md` | planner, designer, browser-qa |
| `env-vars.md` | developer, security-auditor |
| Custom `.md` files | reviewer, security-auditor (read ALL) |

---

## Agents

### Build Team

| Agent | Model | Role |
|-------|-------|------|
| **planner** | opus | 6 Forcing Questions + 4-Lens Self-Review (CEO, Engineering, Design, QA). Plans scored 1-10 per lens. |
| **designer** | opus | Web research for UI/UX references → Playwright screenshots → Figma MCP → production components. AI slop blacklist. |
| **developer** | sonnet | Implements features following plan + design + harness conventions. |

### Quality Team

| Agent | Model | Role |
|-------|-------|------|
| **qa-tester** | sonnet | Code-level verification — types, lint, build, acceptance criteria. |
| **browser-qa** | sonnet | Real browser testing via Playwright MCP — flows, responsive, console, health score (0-100). |
| **reviewer** | opus | 4-specialist parallel review (security, perf, testing, maintainability) + adversarial pass + auto-fix. |
| **health-checker** | sonnet | Code quality dashboard — 7-category weighted 0-10 score + trends. |

### Security & Ops

| Agent | Model | Role |
|-------|-------|------|
| **security-auditor** | opus | OWASP Top 10 + STRIDE threat model. 10-phase audit with confidence gate. |
| **canary-monitor** | sonnet | Post-deploy health — pages, APIs, console, performance vs baseline. |
| **shipper** | sonnet | Release pipeline — test → version bump → changelog → PR. |

### Specialist

| Agent | Model | Role |
|-------|-------|------|
| **investigator** | sonnet | Root cause debugging. 4-phase investigation. Edit freeze on unrelated code. |

---

## 9 Operating Modes

Talk to `@constitution` naturally. It auto-detects the mode.

| Mode | Example | Pipeline |
|------|---------|----------|
| **Feature** | "Add user dashboard" | Plan → Design → Dev → QA → Browser QA → Review |
| **Project Audit** | "full project audit" | Scan → Prioritize → Fix → Verify (loop) |
| **Browser QA** | "browser qa localhost:3000" | Playwright tests + health score |
| **Security** | "security audit" | OWASP + STRIDE + secrets + deps |
| **Debug** | "debug: login broken" | 4-phase root cause investigation |
| **Health** | "health check" | Quality dashboard (types, lint, deps, i18n) |
| **Canary** | "canary https://myapp.com" | Post-deploy production monitoring |
| **Review** | "code review" | Multi-specialist analysis + auto-fix |
| **Ship** | "ship" | Test → version → changelog → PR |

### Mode chaining

Constitution auto-suggests the next mode:
- Feature complete → Ship → Canary
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
├── 05-browser-qa.md     Health score + screenshots + flows
├── 06-review.md         Review findings + auto-fixes applied
└── 07-ship.md           PR URL + release notes
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `npx buildcrew` | Install 11 agents |
| `npx buildcrew init` | Auto-generate harness (zero questions) |
| `npx buildcrew init --force` | Regenerate harness |
| `npx buildcrew add` | List harness templates |
| `npx buildcrew add <name>` | Add a template (erd, architecture, etc.) |
| `npx buildcrew harness` | Show harness file status |
| `npx buildcrew --force` | Overwrite existing agents |
| `npx buildcrew --list` | List agents with models |
| `npx buildcrew --uninstall` | Remove agents |
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

```
.claude/agents/      Agent definitions — edit roles, tools, model
.claude/harness/     Project context — edit anytime, add any .md
.claude/pipeline/    Output documents — auto-generated per feature
```

## Architecture

```
@constitution (orchestrator, opus)
    │
    ├─ reads .claude/harness/*.md
    ├─ detects mode from user message
    ├─ dispatches agents with harness context
    └─ enforces quality gates + iteration
         │
         ├── Build:    planner → designer → developer
         ├── Quality:  qa-tester → browser-qa → reviewer
         ├── Sec/Ops:  security-auditor, canary-monitor, shipper
         └── Debug:    investigator
```

## License

MIT
