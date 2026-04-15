# Changelog

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
