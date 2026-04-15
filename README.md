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
1. Install 17 agents + orchestrator
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

### Adversarial Team

Runs between pipeline stages to catch errors *before* downstream agents commit. Produces structured critique with APPROVED / REVISE / REJECT verdict and a revise loop.

| Agent | Model | Role |
|-------|-------|------|
| **plan-challenger** | opus | Attacks `01-plan.md` across 6 vectors (premise, scope, alternatives, risks, acceptance criteria, metrics). Runs AFTER planner, BEFORE designer. Writes `01.5-plan-critique.md`. |
| **spec-challenger** | opus | Attacks `02-design.md` document (not rendered UI) across 8 vectors (plan alignment, state coverage, edge cases, data flow, failure modes, accessibility, motion spec, developer contract). Runs AFTER designer, BEFORE developer. Writes `02.5-spec-critique.md`. |

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
| **Feature** | "Add user dashboard" | Plan → Plan-Challenger → Design → Spec-Challenger → Dev → QA → Browser QA → Review → Coherence |
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

## Adversarial Challengers

Between the existing pipeline stages, two challenger agents attack the upstream artifact before downstream agents commit. A wrong plan poisons everything downstream — `plan-challenger` catches plan errors while they're still cheap. A thin spec forces developers to invent critical details — `spec-challenger` catches spec gaps before developer writes a line.

### The revise loop

```
planner → plan-challenger ─┬─ APPROVED → designer
                           ├─ REVISE  → planner re-runs (max 2 cycles)
                           └─ REJECT  → escalate to user

designer → spec-challenger ─┬─ APPROVED → developer
                            ├─ REVISE  → designer re-runs (max 2 cycles)
                            └─ REJECT  → escalate to user
```

- **APPROVED**: 0 blocking findings. Proceed.
- **REVISE**: ≥1 blocking finding but premise is intact. Upstream agent re-runs with critique file as an input, must address every blocking item (nits optional). Max 2 revise cycles; 3rd deadlock escalates to user.
- **REJECT**: premise-level crack (≥3 blocking in Vector 1). Pipeline halts immediately and presents the critique — no auto-fix, human direction needed.

### Attack vectors

**`plan-challenger` (6 vectors):** Premise (demand evidence, specific user, opportunity cost) · Scope (cut-50% test, hidden creep) · Alternatives (≥2 compared + build-vs-buy + do-nothing) · Risks (load-bearing assumptions, failure modes, reversibility) · Acceptance Criteria (binary pass/fail, observable, negative cases) · Metrics (measurable, causal, baseline, timeframe).

**`spec-challenger` (8 vectors):** Plan Alignment (matrix of every plan criterion → spec coverage) · State Coverage (matrix of every component × required states) · Edge Cases (tiny/huge screens, slow network, concurrent edits, long text, RTL, reduced motion) · Data Flow (input source, optimistic vs pessimistic, cache) · Failure Modes (network/auth/permission/race) · Accessibility (keyboard, focus, screen reader, contrast, live regions, touch targets) · Motion Spec (per-component map, named durations/easings, reduced-motion fallback) · Developer Contract (props, handlers, side effects, file structure, testing hooks).

### Why not merge with existing reviewers

`reviewer` (post-dev code review), `design-reviewer` (post-dev rendered UI review), `qa-auditor` (post-dev diff audit), and `coherence-auditor` (final handoff consistency) all run AFTER developer. Challengers are structurally different: pre-dev, on documents, with revise loops. Merging would destroy the asymmetry that makes each role sharp.

---

## Verifiable Coordination

How do you know the 17 agents actually worked as a team, instead of running in sequence and pretending to collaborate?

buildcrew answers this with **Coordination Score** — a 0-100% measurement output at the end of every Feature run.

### How it works

1. **Every agent ends its output with a `## Handoff Record` section** declaring three things:
   - `Inputs consumed` — what files/sections it actually read
   - `Outputs for next agents` — what it produced and who should consume it
   - `Decisions NOT covered by inputs` — autonomous judgment calls with reasons

2. **A meta-agent `coherence-auditor` runs LAST** and:
   - Parses every Handoff Record
   - Cross-checks: did agent B actually cite agent A's outputs?
   - Reads cited source files to verify the implementation matches the cited requirement (CONFIRMED / PARTIAL / MISSING_IN_CODE)
   - Computes Coordination Score and writes `coherence-report.md`

3. **The crew report shows the score**:

```
📊 buildcrew Report
─────────────────────────────
✅ Agents: planner, plan-challenger, designer, spec-challenger,
          developer, qa-tester, reviewer, coherence-auditor
🔄 Outer iterations: 2/3
🎯 Challenger verdicts:
   plan-challenger : APPROVED (0 blocking, 2 nits) after 1 revise cycle
   spec-challenger : APPROVED (0 blocking, 3 nits) on first pass
🎯 Coordination Score: 82% — Normal (9/11 edges, 0 fabrications, 2 gaps)
📁 Output: .claude/pipeline/{feature-name}/
   ├── 01-plan.md             ├── 02-design.md
   ├── 01.5-plan-critique.md  ├── 02.5-spec-critique.md
   └── coherence-report.md
─────────────────────────────
```

### Score thresholds

| Score | Status | What it means |
|---|---|---|
| 90-100 | Healthy | Real team collaboration |
| 70-89 | Normal | Minor gaps, ship-ready |
| 50-69 | Suspicious | Coordination has holes — review the design |
| 0-49 | Theater | ⚠️ This is not a team — it's 17 independent scripts |

### What gets caught

- **Gaps**: agent A declared output X for agent B, but B never cited it
- **Fabrications**: agent B cited "plan section #4" that doesn't exist, or claimed to implement X but the code shows no evidence
- **Orphans**: an agent whose work nothing downstream cited (the team ignored its output)

This makes "team collaboration" a measurable property, not a marketing claim. Full spec: `docs/02-design/coordination-verifiability.md`. Policy: `docs/ADR-001-deps.md`.

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

## Dashboard

Real-time observability for buildcrew sessions. A pixel-art office visualization where your 17 agents come alive — walking between rooms, filing issues, and progressing through the pipeline — all powered by Claude Code hooks and zero external dependencies.

### Quick Start

```bash
# 1. Install hooks into your project
npx buildcrew-dashboard --install

# 2. Start the dashboard server (opens browser automatically)
npx buildcrew-dashboard
```

Then open any Claude Code session with `@buildcrew` in the same directory. Events stream to the dashboard in real time.

### What You See

| Panel | Description |
|-------|-------------|
| **Pixel Town** | 5 rooms (Meeting, QA Lab, SecOps, Think Tank, Field) with 16 animated agent sprites |
| **Stage Ladder** | Pipeline progress: PLAN → DESIGN → DEV → QA → REVIEW → SHIP |
| **Billboard** | Current stage, notification badge, issue ticker |
| **Log Panel** | 3 tabs — Events (filterable log), Dialogue (agent conversation view), Terminal (command output) |

### Command Bar

The Terminal tab includes a command bar that spawns `claude -p` on the server. Three permission modes:

| Mode | Flag | Use When |
|------|------|----------|
| **Strict** | `default` | Production work — every tool call needs approval |
| **Normal** | `acceptEdits` | Day-to-day — file edits auto-approved |
| **Trust** | `bypassPermissions` | Demos and solo work — everything auto-approved |

### Hooks

`--install` adds four Claude Code hooks to `.claude/settings.json`:

- **PreToolUse** (Agent) — captures agent dispatch
- **PostToolUse** (Agent, Write/Edit) — captures agent completion and file writes
- **UserPromptSubmit** — captures session start
- **Stop** — captures session end

Hooks are tagged `buildcrew-dashboard` for safe removal via `--uninstall`. They timeout at 500ms and never block Claude Code.

### Multi-Session

The dashboard tracks multiple concurrent Claude Code sessions in the same project. Each session gets a unique color chip. Filter by session to see isolated event streams.

### CLI Options

| Flag | Description |
|------|-------------|
| `--install` | Install Claude Code hooks (project-local) |
| `--install --global` | Install hooks globally |
| `--install --with-permissions` | Also auto-allow buildcrew tool calls |
| `--install --dry-run` | Preview changes without writing |
| `--uninstall` | Remove hooks |
| `--uninstall --global` | Remove global hooks |
| `--port N` | Custom port (default: 3737) |
| `--no-open` | Start server without opening browser |

### Demo Mode

```bash
# Terminal 1: start the dashboard
npx buildcrew-dashboard

# Terminal 2: run the demo script
node node_modules/buildcrew/bin/dashboard-demo.js
```

The demo simulates a full Feature pipeline with realistic Korean dialogue between agents.

---

## Feature Pipeline

Each feature generates a full document chain:

```
.claude/pipeline/{feature}/
├── 01-plan.md              Requirements + 4-lens review scores
├── 01.5-plan-critique.md   plan-challenger verdict + 6-vector findings
├── 02-design.md            Design decisions + component specs
├── 02.5-spec-critique.md   spec-challenger verdict + 8-vector findings + matrices
├── 03-dev-notes.md         Implementation + 6-question analysis + self-review
├── 04-qa-report.md         Test map + acceptance criteria verification
├── 05-browser-qa.md        Health score + screenshots + flows
├── 06-review.md            4-specialist findings + auto-fixes
├── 07-ship.md              PR URL + release notes
└── coherence-report.md     Coordination Score + gaps + fabrications + orphans
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
         ├── Think:        thinker → architect
         ├── Build:        planner → designer → developer
         ├── Adversarial:  plan-challenger, spec-challenger  (phase-boundary critics)
         ├── Quality:      qa-tester → browser-qa → reviewer
         ├── Sec/Ops:      security-auditor, canary-monitor, shipper
         ├── Review:       architect, design-reviewer, qa-auditor
         ├── Meta:         coherence-auditor  (final handoff audit)
         └── Debug:        investigator
```

### Version Auto-Update

Agents include version headers. When you run `npx buildcrew` on an existing project, outdated agents are automatically updated — no `--force` needed.

## License

MIT

<!-- v1.9.0 -->
