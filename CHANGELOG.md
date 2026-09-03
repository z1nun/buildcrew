# Changelog

## v1.13.0

Spec-driven development release. The feature pipeline now has a two-stage review: an independent **spec-compliance gate** before the code-quality review, closing the "beautifully built but does the wrong thing" hole.

### Added: `spec-verifier` agent (18th agent)

- New `agents/spec-verifier.md` (sonnet). Runs after qa-tester/browser-qa and BEFORE reviewer. Verifies every acceptance criterion from `01-plan.md` against the actual implementation with `file:line` evidence, checks design-spec conformance, and flags scope creep. Verdict PASS/FAIL — one UNMET criterion fails the gate.
- Orchestrator wiring: FAIL re-dispatches `developer` with the Unmet Summary (max 2 fix cycles, then escalate); `reviewer` is dispatched only after PASS. New output artifact `03.5-spec-verification.md`; pre-ship checklist and crew report updated.
- `planner` acceptance criteria are now numbered (`AC-1 …`) so the verifier can cite them per-criterion.
- Role separation is explicit: spec-verifier answers "does it do what was specified?", reviewer answers "is it well built?" — the orchestrator forbids merging the two stages.

### Changed

- `skills/buildcrew/SKILL.md` pipeline includes the spec-verifier fix loop; all skill versions bumped.
- README (en/ko): 18-agent count, pipeline diagrams, agent tables.

## v1.12.0

Agent Skills release. buildcrew now ships its pipelines in the open [Agent Skills](https://agentskills.io) SKILL.md standard alongside the existing Claude Code subagents — one install works across Claude Code, Codex, GitHub Copilot, Cursor, Gemini CLI and other skills-compatible tools.

### Added: `skills/` distribution

- 7 skills covering the 13 operating modes: `buildcrew` (full feature pipeline), `buildcrew-qa`, `buildcrew-security`, `buildcrew-debug`, `buildcrew-review`, `buildcrew-ship`, `buildcrew-think`.
- Each SKILL.md carries the pipeline order, discipline rules (challengers, reviewer independence, iteration caps, Handoff Records) and points at `.claude/agents/*.md` as the single source of truth for role prompts. With subagent support the skill dispatches subagents; in single-context tools it adopts roles sequentially.
- `npx buildcrew` now syncs `skills/<name>/SKILL.md` → `.claude/skills/<name>/` with the same version-aware update logic as agents (new → copy, version bump → update, else skip; `--force` overwrites). `--uninstall` removes only the skills this package ships — user-authored skills are untouched.
- New `syncSkills()` in `lib/cli/install.js`, exported for tests. 10 new tests (source-shape validation mirroring the agent checks + sync behavior in a tmp cwd): 171 → 181.

### Changed

- `package.json`: `skills/` added to published files; keywords gained `agent-skills`, `claude-skills`; applied `npm pkg fix` normalizations from the v1.11.0 publish warnings (bin paths without `./`, `repository.url` in `git+https` form).
- README: new "Agent Skills" section.

## v1.11.0

Internal hardening release. No public API or CLI behavior changes — every command (`init`, `add`, `install`, `watch`, `report`, `list`, `--version`, `--help`) routes identically. The work consolidates two large bin scripts into testable module trees, raises test coverage from 73 to 171, lands an ESLint 9 flat config that matches the harness `rules.md`, clears two transitive `npm audit` advisories, and makes the hook entry point silent-fail so it can never block Claude Code prompts.

### Why

`bin/setup.js` (814 lines, 14 functions) and `bin/watch.js` (653 lines, 23 functions) had grown into the two pieces of the codebase most likely to silently break and least amenable to testing. The setup binary mixed init/add/install/watch/report/list/uninstall in a single file; the watch binary mixed event parsing, ANSI rendering, file tailing, and stdin handling. Both are now ~55-line orchestrators delegating to focused modules, with the parser (the surface most likely to silently break the dashboard) testable in isolation.

### Changed: `bin/setup.js` split into `lib/cli/`

- `bin/setup.js` 814 → 55 lines. Now a thin argv router.
- New modules under `lib/cli/`:
  - `utils.js` — ANSI palette, `log`/`exists`/`ask`, path constants
  - `templates.js` — `TEMPLATES` registry + `detectProject()`
  - `init.js` — `runInit` + `buildProjectMd` + `buildRulesMd`
  - `add.js` — `runAdd` + `runHarnessStatus`
  - `install.js` — `runInstall` + `runUninstall` + `areHooksInstalled`
  - `list.js` — `runList`
  - `watch.js` — wrapper around `bin/watch.js`
  - `report.js` — `runReport`
  - `help.js` — `runHelp` + `runVersion`
- Subcommand routing still precedes the global `--list` flag, so `report --list` resolves correctly. `detectProject`, `buildProjectMd`, `buildRulesMd` are now pure functions exposed for snapshot-style tests.

### Changed: `bin/watch.js` split into `lib/watch/`

- `bin/watch.js` 653 → 59 lines. Now a boot orchestrator: build state, wire renderer, start tail loop.
- New modules:
  - `lib/watch/state.js` (327 lines) — `events.jsonl` parser, coherence loader, file tailer. `handleEvent` only mutates the state passed in.
  - `lib/watch/render.js` (338 lines) — ANSI palette + frame composition. Read-only over state. `scheduleRender` lives here.
  - `lib/watch/input.js` (80 lines) — alt-screen lifecycle, signal handlers, keypress dispatch (`q` quit, `r` open coherence report).

### Added: ESLint 9 flat config (`eslint.config.js`)

- Encodes `.claude/harness/rules.md` as enforceable lint rules so the lint pass and the agent review pass agree on what counts as a violation.
- Rules: `no-console: error` (overridden in 5 files that own terminal output), `no-var`, `prefer-const`, `no-unused-vars` with `^_` exception, `no-restricted-syntax` banning `ExportDefaultDeclaration` (rules.md: "no default exports"), `eqeqeq` with `{ null: "ignore" }` (`== null` is canonical nullish check), `prefer-arrow-callback` (warn). Test files allow `console` for debugging.
- Real violations fixed (not silenced): unused imports in `lib/cli/help.js`, `test/setup.test.js`, `test/hook-events.test.js`. Three redundant inline `eslint-disable-next-line` directives removed.
- `npm run lint` now passes with 0 errors, 0 warnings.

### Fixed: hook entry point can never block CC

- `bin/hook.js` `await import("../lib/hook.js")` had no catch — a corrupted install would surface a hook-failure popup on every CC prompt.
- `lib/hook.js` `main()` was called without `.catch()` — any throw in a try-less branch became an unhandled rejection.
- Both now silent-fail (exit 0). Errors surface to stderr only when `BUILDCREW_HOOK_DEBUG=1`, preserving the documented "hooks must never block CC" guarantee while keeping a debug knob.

### Added: `BUILDCREW_HOOK_DEBUG` env var

- Set `BUILDCREW_HOOK_DEBUG=1` to surface hook errors to stderr instead of silent-failing. Off by default.

### Added: test coverage 73 → 171 (+98 tests, +134%)

- `test/install-hooks.test.js` (18 tests) — install/uninstall against real tmp dir: merge idempotency, preserves user's non-buildcrew hooks, `settings.local.json` for permissions, permission de-dup on merge, uninstall removes empty `hooks` key, backup on overwrite, absolute-path node command (matches v1.9.2 fix that was bare-untested before).
- `test/hook-events.test.js` (24 tests) — drives `toEvents()` with synthetic CC payloads: all 6 event kinds + unknown-kind fallback, prompt/summary truncation contracts (400/500 chars), `@mention` parsing dedup + lowercase + whitespace-required regex (so `user@example.com` doesn't dispatch), `session_id` synthesis, file-written agent fallback to `"buildcrew"`. To enable testing, `lib/hook.js` now exports `toEvents` and skips `main()` when `BUILDCREW_HOOK_TEST=1` (zero runtime behavior change).
- `test/watch-state.test.js` (28 tests) — parser contract: `session.start` state-clear semantics, agent lifecycle + sweep, coherence reload triggers, recent-window caps, `parseCoherenceReport` tolerance.
- `test/cli-templates.test.js`, `test/cli-init.test.js`, `test/cli-install.test.js` (28 tests) — unit coverage of newly extracted CLI modules.

### Changed: dev dependencies

- `vitest` 4.1.2 → 4.1.5 transitively pulls `vite` 8.0.3 → 8.0.10 (clears HIGH advisories GHSA-4w7w-66w2-5vf9, v2wj-q39q-566r, p9ff-h696-f583 — path traversal, `server.fs.deny` bypass, dev-server WS arbitrary file read) and `postcss` 8.5.8 → 8.5.14 (clears MODERATE advisory GHSA-qx2v-qp2m-jg93 — XSS in CSS stringify). Both vulnerabilities only affect dev tooling — buildcrew's runtime is dep-free — but `npm audit` now reports 0 vulnerabilities for contributors.

### Upgrading

No action required for existing projects. The CLI, agents, hooks, and watch dashboard all behave identically to v1.10.0. `npm install buildcrew@latest` to pick up the audit-clean lockfile.

## v1.10.0

Adversarial challengers at plan and spec boundaries. Two new agents — `plan-challenger` and `spec-challenger` — run between existing pipeline stages and attack the upstream artifact before downstream agents commit. Catches wrong premises and under-specified designs while they're still cheap to fix, instead of letting errors compound through design → dev → QA.

### Why

The existing pipeline's only cross-checks ran at the end: `qa-auditor` audited final diffs, `coherence-auditor` verified handoff consistency. Both catch problems *after* the team has spent tokens building on a flawed foundation. A wrong plan produces a wrong design produces wrong code produces wrong tests — by the time the auditors flag it, the cost is sunk.

The two challengers run at **phase boundaries** instead of the end. They're asymmetric: the planner/designer was paid to make the artifact look solid; the challenger is paid to find where it genuinely isn't, and either clear it for the next agent or send it back with a structured critique.

### Added: `plan-challenger`

- Runs AFTER `planner` emits `01-plan.md`, BEFORE `designer` starts.
- Attacks the plan across 6 vectors: **Premise** (demand evidence, specific user, opportunity cost), **Scope** (cut-50% test, hidden creep), **Alternatives** (≥2 compared + build-vs-buy + do-nothing), **Risks** (load-bearing assumptions, failure modes, reversibility), **Acceptance Criteria** (binary pass/fail, observable, negative cases), **Metrics** (measurable, causal, baseline, timeframe).
- Every finding cites a specific anchor in `01-plan.md` with evidence from harness, git log, existing code, or web search.
- Severity triage: 🔴 BLOCKING / 🟡 NIT / 🔵 FYI. Conservative rule: uncertain → NIT.
- **Verdict rules (exact):** ≥3 BLOCKING findings in Vector 1 (Premise) → REJECT (escalate to user). ≥1 BLOCKING anywhere else → REVISE (back to planner). 0 BLOCKING → APPROVED (proceed to designer).
- Writes to `.claude/pipeline/{feature}/01.5-plan-critique.md` with full Handoff Record.
- Model: opus. Adversarial reasoning depth > speed.

### Added: `spec-challenger`

- Runs AFTER `designer` emits `02-design.md`, BEFORE `developer` starts.
- Attacks the **spec document**, not rendered UI (`design-reviewer` continues to handle rendered UI post-dev — the roles don't overlap).
- Attacks across 8 vectors: **Plan Alignment** (acceptance criteria → spec element mapping matrix), **State Coverage** (default/loading/error/empty/success/hover/focus/disabled/first-time/offline), **Edge Cases** (tiny/huge screens, slow network, concurrent edits, long text, RTL, reduced motion), **Data Flow** (input source, update trigger, optimistic vs pessimistic, cache strategy), **Failure Modes** (network failure, auth expired, permission denied, race conditions), **Accessibility** (keyboard, focus management, screen reader, contrast, live regions, touch targets), **Motion Spec** (per-component map, named durations/easings, reduced-motion fallback), **Developer Contract** (props, handlers, side effects, file structure, testing hooks).
- Produces a **Plan Alignment Matrix** (every plan acceptance criterion → spec coverage status) and a **State Coverage Matrix** (every component × every required state) as required sections — quickest way to surface the biggest gap class.
- **Verdict rules:** ≥3 BLOCKING in Vector 1 (Plan Alignment) → REJECT (spec doesn't fulfill plan — designer redo). ≥1 BLOCKING anywhere → REVISE. 0 BLOCKING → APPROVED.
- Writes to `.claude/pipeline/{feature}/02.5-spec-critique.md`.
- Model: opus.

### Changed: Mode 1 pipeline

```
planner → plan-challenger → (revise loop, max 2) → designer → spec-challenger → (revise loop, max 2) → developer → qa-tester → browser-qa → reviewer → coherence-auditor
```

- Each challenger's **revise loop** caps at 2 cycles. 3rd consecutive REVISE verdict escalates to the user (planner + challenger are deadlocked on a judgment call the user must arbitrate).
- Any REJECT verdict halts the pipeline immediately and presents the critique to the user. No auto-fix on REJECT — the premise or plan-fidelity break needs human direction.
- `spec-challenger` is skipped when `designer` is skipped (non-UI feature).
- `coherence-auditor` still runs exactly once at the very end of all outer iterations.

### Changed: `buildcrew` orchestrator

- Team Members table gained an **Adversarial** row with both challengers.
- Enforcement rules #2 (don't skip challengers) and #6 (verdict-driven flow) added; existing rules renumbered.
- Pre-ship checklist now requires `01.5-plan-critique.md` and (if UI) `02.5-spec-critique.md` with APPROVED verdict before declaring done.
- **Revise-loop input protocol**: when planner/designer re-run after REVISE, their new Handoff Record MUST cite the critique file's `revision-request` anchor in `Inputs consumed` — this lets `coherence-auditor` verify the revise loop actually happened, not just got logged.
- Crew report now shows per-challenger verdict and revise-cycle count.

### Changed: `coherence-auditor`

- Expected pipeline files list includes `01.5-plan-critique.md` and `02.5-spec-critique.md`.
- Added specific edge-case guidance for REVISE / REJECT halts — if a challenger rejected, the auditor reports only what exists and notes the halt in its Verdict.

### Changed: other

- `bin/setup.js`: banner text "15 AI agents" → "17 AI agents".
- `package.json`: version 1.9.2 → 1.10.0, description updated to mention adversarial challengers.
- Tests: `setup.test.js` agent count 17 → 19 (15 specialists + buildcrew + coherence-auditor + 2 challengers), description match "15" → "17". `handoff-record.test.js`: challengers added to `PRODUCING_AGENTS`, rule-number regex made position-independent since Handoff Record rule moved from #6 to #8 with new inserts.

### Upgrading

Existing projects: `npx buildcrew@latest setup` to install `plan-challenger.md` and `spec-challenger.md` into `.claude/agents/`. No config changes needed — the orchestrator picks them up automatically. Existing in-flight pipelines will start using the challengers from the next `@buildcrew` invocation.

If you have a pipeline currently mid-iteration without challenger critique files, `coherence-auditor` will not flag their absence (they're optional expected files, not required). Future iterations will include them.

### Design notes

- **Why opus, not sonnet.** Adversarial reasoning over structured docs needs depth. A sonnet challenger will produce surface-level critique ("consider more edge cases" without specifics). Opus reliably produces cited, actionable findings.
- **Why not merge with existing reviewers.** `reviewer` (post-dev code review), `design-reviewer` (post-dev UI review), `qa-auditor` (post-dev diff audit), `coherence-auditor` (final handoff consistency) all run AFTER developer. Challengers are structurally different: pre-dev, on documents, with revise loops. Merging would destroy the asymmetry that makes each role sharp.
- **Why "challenger" not "reviewer" or "critic".** Reviewer/critic imply final judgment. Challenger implies adversarial sparring in service of a better plan — the verdict has a revise path, not just pass/fail.
- **Why REJECT is separate from REVISE.** REVISE means the artifact is fixable within the upstream agent's mandate. REJECT means the problem is upstream of the upstream agent (bad premise, plan doesn't match intent) and needs human arbitration.

## v1.9.2

Quality-of-life patch — fixes two papercuts that made `buildcrew watch` and the hook pipeline unreliable on consumer projects.

### Fixed

- **Hook installer no longer 404s on consumers.** The generated `.claude/settings.json` used `npx buildcrew-hook <kind>`, which makes npx look up `buildcrew-hook` as a package name in the npm registry. That package does not exist (it's a bin inside the `buildcrew` package), so every hook fired with HTTP 404 and silently dropped every `agent.dispatched` / `agent.completed` / `file.written` / `session.*` event. The watch dashboard and coherence pipeline could never populate. Now the installer resolves an absolute path to `lib/hook.js` at install time and emits `node "<abs-path>" <kind>` — no registry lookup, no per-call latency, immune to npx cache eviction, and shell-safe for non-ASCII install paths.
- **`buildcrew watch` no longer flickers.** Three causes were stacked: (1) full-screen clear `\x1b[2J\x1b[H` flashed an empty buffer between frames, (2) the ~30 per-frame `console.log` calls each flushed independently, exposing intermediate paint states, (3) the 1Hz heartbeat redrew the whole screen for elapsed-time updates. Now we collect the entire frame into a buffer and emit it in a single `stdout.write` using cursor-home + per-line erase-to-EOL + trailing erase-below.
- **`buildcrew watch` enters the alternate screen buffer** on start and leaves it on quit, so quitting returns the user to their pre-watch terminal state instead of leaving the dashboard scribble in scrollback.
- **NOW agents no longer "run forever".** When CC's @-mention parsing emits `agent.dispatched` without a matching `agent.completed` (the parser tags textual mentions as dispatches even when no Agent tool actually runs), the NOW section showed agents as active with elapsed time growing across the whole watch session. On `session.end` we now sweep every still-active agent into completedAgents.
- **PIPELINE / ROSTER reset on session boundaries.** Previously every checkmark and stage was cumulative across the entire `events.jsonl` history, so the pipeline showed "DESIGN ✓ DEV ✓" even when the current session had only asked a question. Now `session.start` clears per-session state (current stage, completed stages, completed agents, file/issue/event counters, recent log) while preserving coherence (file-derived) and session metadata.

### Changed

- Watch palette: replaced the dim `\x1b[90m` gray with a brighter 256-color light gray (`\x1b[38;5;250m`). Active-agent prompts and log dispatch text are no longer wrapped in gray — they're real content, not metadata. A new `muted` color (`\x1b[38;5;244m`) is used for timestamps and separators.

### Upgrading

Existing projects need to re-run `npx buildcrew@latest setup` once to regenerate `.claude/settings.json` with the new hook command. Verify the result with `grep '"command"' .claude/settings.json` — it should show `node "<abs-path>/lib/hook.js" …`, not `npx buildcrew-hook …`.

## v1.9.1

Coherence visibility — make the coordination score immediately accessible from the CLI and live watch, without manually opening files.

### Added: `npx buildcrew report`

- **`npx buildcrew report`** — show latest coherence-report.md, paged through `less` if it doesn't fit in the terminal
- **`npx buildcrew report --list`** — list all coherence reports with timestamps and paths
- **`npx buildcrew report <feature>`** — show a specific feature's report
- **`npx buildcrew report --raw`** — print raw markdown (pipe to `pbcopy`, `bat`, etc.)

### Added: live coherence panel in `npx buildcrew watch`

The terminal watch now surfaces the most recent Coordination Score as a dedicated `COHERENCE` panel below the existing sections. Updates automatically when:

- `coherence-auditor` finishes (via `agent.completed` event)
- A new `coherence-report.md` is written (via `file.written` event)
- Watch starts up (last report is loaded immediately so users see their previous score)

Score is color-coded by status threshold: green ≥90 (Healthy), cyan 70-89 (Normal), gold 50-69 (Suspicious), red <50 (Theater). Gaps and fabrications shown as inline badges.

**Keypress 'r'** — opens the full coherence report inside the watch session (delegates to `npx buildcrew report`, paging via `less`). Returns to the watch dashboard on exit.

### Fixed

- **`npx buildcrew watch` crash on first install** — `ERR_OUT_OF_RANGE` thrown by `replayExisting()` when `events.jsonl` was empty (size 0). Now skips replay gracefully and connects to live tail.

### Why

v1.9.0 introduced Verifiable Coordination, but the only ways to see the result were the 1-line score in `@buildcrew`'s terminal output, or manually opening `.claude/pipeline/{feature}/coherence-report.md`. This makes the score and full analysis a single command away — no path memorization, no editor switch — and surfaces it live in the watch terminal.

### Internal

- Subcommand routing now precedes the global `--list` flag in `bin/setup.js`, so `report --list` works correctly. Existing `npx buildcrew --list` (agent listing) is unaffected.
- `bin/watch.js`: +114 LOC (`loadLatestCoherence()` parser, `renderCoherence()` panel, keypress 'r' handler, empty-file replay guard).

## v1.9.0

Two changes ship together: the dashboard pivot from Phaser to terminal-native watch, and the introduction of Verifiable Coordination — a measurement layer for whether the 15 agents actually function as a team.

### Dashboard pivot — Phaser → terminal-native watch

The previous v1.8.x line introduced an HTML/Phaser-based dashboard for session observability. v1.9.0 removes it (~4900 LOC of `dashboard/*` deleted) and replaces it with a 473-LOC terminal-native ANSI watch. Aligns with the zero-dep philosophy: all observability via `node:` builtins, no runtime npm dependencies added.

- **`npx buildcrew watch`** — terminal-native live monitor that tails `.claude/buildcrew/events.jsonl` and renders a compact live status pane
- **`buildcrew-hook`** + `lib/hook.js` — emits structured events (`session.start`, `agent.dispatched`, `agent.completed`, `file.written`, `session.end`) on Claude Code hook firing
- **`lib/install-hooks.js`** — wires SessionStart/SubagentStop into the user's Claude Code config

### Verifiable Coordination

- **Handoff Record** — every producing agent ends its output with a structured `## Handoff Record` section: Inputs consumed, Outputs for next agents, Decisions NOT covered by inputs. Strict GFM anchor grammar so a parser can verify references.
- **`coherence-auditor`** (new meta-agent, opus) — runs LAST in Feature mode. 5-phase workflow: parse Handoff Records, resolve markdown references, cross-verify cited source code (CONFIRMED/PARTIAL/MISSING_IN_CODE), compute Coordination Score 0-100%, write `.claude/pipeline/{feature}/coherence-report.md`.
- **Per-agent specialization** — reviewer, investigator, thinker, qa-auditor, design-reviewer get extra Handoff fields (Handoff verification, root cause trace, assumption chain, subagent consolidation, UX score provenance).
- **Orchestrator enforcement** — `agents/buildcrew.md` rule 6 makes Handoff Record mandatory and `coherence-auditor` a required final step. Crew Report surfaces Coordination Score with Theater warning when score < 50%.
- **Tests** — `test/handoff-record.test.js` verifies all 15 producing agents declare HR, 5 specialized agents have extra fields, coherence-auditor structure, orchestrator enforcement.
- **Documentation** — full design at `docs/02-design/coordination-verifiability.md`, dependency policy at `docs/ADR-001-deps.md`.

### Infrastructure

- Zero runtime dependencies maintained (node: builtins only)
- 17 agent files (15 specialists + buildcrew orchestrator + coherence-auditor meta)
