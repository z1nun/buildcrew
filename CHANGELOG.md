# Changelog

## v1.9.0

Interactive dashboard for real-time buildcrew session observability.

### Dashboard

- **Pixel Town visualization** — 5 rooms with 16 animated agent sprites (24x32 pixel art, procedurally generated)
- **Stage Ladder** — pipeline progress tracking (PLAN → DESIGN → DEV → QA → REVIEW → SHIP)
- **Billboard** — current stage, notification badge, scrolling issue ticker
- **Log Panel** — three tabs: Events (filterable), Dialogue (agent conversation view), Terminal (command output)
- **Command Bar** — spawn `claude -p` from the dashboard with three permission modes (Strict / Normal / Trust)
- **Multi-session awareness** — concurrent Claude Code sessions tracked with unique color chips and per-session filtering
- **SSE event stream** — append-only JSONL format, live tail with backlog replay on connect
- **Claude Code hooks** — auto-installer for PreToolUse, PostToolUse, UserPromptSubmit, Stop hooks
- **Responsive layout** — adaptive speech bubbles and panel sizing
- **Sound effects** — audio cues for agent dispatch, completion, and issues (with mute toggle)
- **Export** — download session events as `.jsonl`

### Core

- **Feature mode enforcement** — pipeline skip violations surfaced as warnings in dashboard
- **Hook installer** — `--install` / `--uninstall` / `--global` / `--dry-run` / `--with-permissions`
- **CLI integration** — `npx buildcrew-dashboard` starts server and opens browser
- **Demo script** — `bin/dashboard-demo.js` simulates a full Feature pipeline with realistic agent dialogue

### Infrastructure

- Zero runtime dependencies (node:http, node:fs, node:child_process only)
- Phaser 3 loaded from CDN for client visualization
- 500ms hook timeout — never blocks Claude Code
- Tagged hooks (`buildcrew-dashboard`) for safe removal
