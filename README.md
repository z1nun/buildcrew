# buildcrew

> **English** | [한국어](README.ko.md) | [Docs](https://buildcrew-landing.vercel.app)

15 AI agents for Claude Code — full development lifecycle from product thinking to production monitoring.

```bash
npx buildcrew
```

---

## Why buildcrew?

AI coding agents are powerful, but without structure they produce inconsistent results. buildcrew gives Claude Code:

- **A team** — 15 specialized agents (7 opus + 8 sonnet), each with a clear role
- **A process** — sequential pipeline with quality gates and iteration
- **A harness** — your project context auto-detected from your codebase
- **An orchestrator** — just talk to `@buildcrew`, it routes automatically
- **A second opinion** — independent review after every mode (Codex or Claude subagent)

```
You:   @buildcrew Add user authentication
Crew:  Planner → Designer → Developer → QA → Browser QA → Reviewer → Ship
```

No external dependencies. No runtime. No binaries. Just Markdown.

---

## Getting Started

One command does everything:

```bash
npx buildcrew
```

The interactive setup will:
1. Install 15 agents + orchestrator
2. Ask to install Playwright MCP (required for browser testing)
3. Ask to generate project harness (auto-detects your stack)
4. Let you pick additional harness templates

Then start working:

```bash
@buildcrew Add user dashboard
```

---

## Agents

### Build Team

| Agent | Model | Role |
|-------|-------|------|
| **planner** | opus | 6 Forcing Questions + 4-Lens Self-Review (CEO, Engineering, Design, QA). Plans scored 1-10 per lens. |
| **designer** | opus | UI/UX research + motion engineering. Playwright screenshots, Figma MCP, production components with animations. AI slop blacklist. |
| **developer** | opus | 6 Implementation Questions + 3-Lens Self-Review (Architecture, Code Quality, Safety). Error Handling Protocol. 3 modes: feature, bugfix, iteration. |

### Quality Team

| Agent | Model | Role |
|-------|-------|------|
| **qa-tester** | sonnet | 5 Test Strategy Questions + Test Map methodology. Edge case generation, confidence-scored findings. |
| **browser-qa** | sonnet | 4-phase browser testing (orient, explore, stress, judge) via Playwright MCP. Health score 0-100, self-review. |
| **reviewer** | opus | 4-specialist analysis (security, perf, testing, maintainability) + confidence scoring + adversarial pass + auto-fix. Runs AFTER code. |
| **health-checker** | sonnet | 3-phase code quality (detect, measure, prescribe). Weighted 0-10 score + trends + top 5 actionable items. |

### Security & Ops

| Agent | Model | Role |
|-------|-------|------|
| **security-auditor** | sonnet | OWASP Top 10 + STRIDE threat model. 10-phase audit with confidence gate. |
| **canary-monitor** | sonnet | 3-phase post-deploy health (orient, verify, judge). Baseline comparison, confidence-scored findings. |
| **shipper** | sonnet | 8-point pre-flight + semver + changelog + PR + post-ship verification. |

### Thinking & Review Team

| Agent | Model | Role |
|-------|-------|------|
| **thinker** | opus | "Should we build this?" — 6 forcing questions, premise challenge, 3 alternatives, cross-model outside perspective, design doc output. |
| **architect** | opus | Architecture review BEFORE code — scope challenge, component diagrams, data flow, failure modes, test coverage map. |
| **design-reviewer** | sonnet | UI/UX quality — 8 dimensions scored 0-10, screenshot evidence via Playwright, specific fixes with effort estimates, WCAG compliance. |

### Specialist

| Agent | Model | Role |
|-------|-------|------|
| **investigator** | sonnet | 4-phase root cause debugging. 12 common bug patterns. Edit freeze on unrelated code. |
| **qa-auditor** | opus | 3 parallel subagents (security, bugs, spec compliance) audit git diffs against design docs. No API key needed. |

---

## 13 Operating Modes

Talk to `@buildcrew` naturally. It auto-detects the mode.

| Mode | Example | Pipeline |
|------|---------|----------|
| **Feature** | "Add user dashboard" | Plan → Design → Dev → QA → Browser QA → Review |
| **Project Audit** | "full project audit" | Scan → Prioritize → Fix → Verify (loop) |
| **Browser QA** | "browser qa localhost:3000" | Playwright testing + health score |
| **Security** | "security audit" | OWASP + STRIDE + secrets + deps |
| **Debug** | "debug: login broken" | 4-phase root cause investigation |
| **Health** | "health check" | Quality dashboard (types, lint, deps, bundle) |
| **Canary** | "canary https://myapp.com" | Post-deploy production monitoring |
| **Review** | "code review" | Multi-specialist analysis + auto-fix |
| **Ship** | "ship" | Test → version → changelog → PR |
| **QA Audit** | "qa" | 3 parallel subagent audit on git diff |
| **Think** | "is this worth building?" | 6 forcing questions + alternatives + design doc |
| **Arch Review** | "architecture review" | Scope challenge + diagrams + failure modes |
| **Design Review** | "design review" | 8-dimension scoring + specific fixes |

### Mode Priority

When a message matches multiple modes, a priority table resolves conflicts. Debug always wins. Think beats Feature. "architecture review" goes to Architect, not Reviewer. If truly ambiguous, asks the user.

### Second Opinion

After any mode completes, buildcrew offers an independent second opinion:
- **Codex CLI available**: genuinely different AI model reviews the work
- **No Codex**: fresh Claude subagent with no session memory

The user decides what to act on.

### Iterations

Each iteration runs the **full end-to-end pipeline**:

```
@buildcrew Add user dashboard, 5 iterations
```

---

## Harness Engineering

`npx buildcrew` auto-detects your stack and generates a project harness.

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

### Generated files

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

### The harness is open

Add any `.md` file to `.claude/harness/` — agents read them all.

```bash
npx buildcrew harness     # Check which files need editing
npx buildcrew add         # List available templates
```

---

## Feature Pipeline

Each feature generates a full document chain:

```
.claude/pipeline/{feature}/
├── 01-plan.md           Requirements + 4-lens review scores
├── 02-design.md         Design decisions + component specs
├── 03-dev-notes.md      Implementation + 6-question analysis + self-review
├── 04-qa-report.md      Test map + acceptance criteria verification
├── 05-browser-qa.md     Health score + screenshots + flows
├── 06-review.md         4-specialist findings + auto-fixes
└── 07-ship.md           PR URL + release notes
```

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `npx buildcrew` | Full interactive setup (agents + MCP + harness) |
| `npx buildcrew init` | Generate harness only |
| `npx buildcrew init --force` | Regenerate harness (backs up existing) |
| `npx buildcrew add` | List harness templates |
| `npx buildcrew add <name>` | Add a template |
| `npx buildcrew harness` | Show harness file status |
| `npx buildcrew --force` | Overwrite existing agents |
| `npx buildcrew --list` | List agents with models |
| `npx buildcrew --uninstall` | Remove agents |
| `npx buildcrew --version` | Show version |

## Requirements

- **Required**: [Claude Code](https://claude.ai/code) CLI
- **Required**: [Playwright MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/playwright) — installed automatically during setup
- **Optional**: [Figma MCP](https://github.com/anthropics/anthropic-quickstarts/tree/main/mcp-servers/figma) — for designer
- **Optional**: [Codex CLI](https://github.com/openai/codex) — for cross-model second opinion

## Architecture

```
@buildcrew (orchestrator, opus, 199 lines)
    │
    ├─ reads .claude/harness/*.md
    ├─ detects mode from user message (13 modes, priority table)
    ├─ dispatches agents with harness context
    ├─ enforces quality gates + iteration
    └─ offers second opinion after completion
         │
         ├── Think:     thinker → architect
         ├── Build:     planner → designer → developer
         ├── Quality:   qa-tester → browser-qa → reviewer
         ├── Sec/Ops:   security-auditor, canary-monitor, shipper
         ├── Review:    architect, design-reviewer, qa-auditor
         └── Debug:     investigator
```

### Version Auto-Update

Agents include version headers. When you run `npx buildcrew` on an existing project, outdated agents are automatically updated — no `--force` needed.

## License

MIT

<!-- v1.8.5 -->
