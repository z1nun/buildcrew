# Changelog

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
