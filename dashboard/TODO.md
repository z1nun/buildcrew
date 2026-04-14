# Dashboard — Pre-ship checklist

Status: **feat/dashboard branch, NOT published yet.**

13 commits, +6000+ lines, 0 dependencies. Works locally. Needs dogfood
and a few cleanups before going public as v1.9.0.

## P0 — blockers before npm publish

- [ ] `package.json` version bump 1.8.7 → 1.9.0
- [ ] `README.md` — add dashboard section with:
  - [ ] What it is (one paragraph + screenshot/GIF)
  - [ ] `npx buildcrew-dashboard` usage
  - [ ] `--install` / `--uninstall` flow for hooks
  - [ ] Command bar / `claude -p` flow
  - [ ] Multi-session support
- [ ] `CHANGELOG.md` (create if missing) — v1.9.0 entry summarizing all
      13 commits in user-facing terms
- [ ] `bin/dashboard-demo.js` — propagate `session_id` so the Phase 1
      session filter/colors demo correctly. Currently demo never sets
      session_id in its /emit calls, so everything lumps under the same
      default bucket.

## P1 — strongly recommended before publish

- [ ] `bin/dashboard.js` when `claude` CLI is missing from PATH, return
      actionable error message in `/command` response rather than generic
      ENOENT.
- [ ] `bin/dashboard.js` `--help` flag documenting all CLI options.
- [ ] Hook PATH stability — current `--install` writes absolute paths
      to `.claude/settings.json` that break if the package is moved or
      re-installed to a different location. Options:
  - Resolve via `require.resolve("buildcrew/dashboard/hooks/emit.js")`
    at hook runtime (requires hook to be a tiny wrapper script).
  - Use `npx buildcrew-hook` as a CLI proxy so the path in
    settings.json is stable regardless of install location.

## P2 — post-ship, feedback-driven

- [ ] Other modes (Debug, Security, etc) in `agents/buildcrew.md` —
      apply the same "MUST dispatch" enforcement language that Feature
      mode got in be7eb5c.
- [ ] Phase 2 multi-session: Town/Ladder/Metrics render per-session
      when a session filter is active (currently aggregate only).
- [ ] Phase 3 multi-session: side-by-side dual-session view.
- [ ] Real-world dogfood with 2-3 external users.
- [ ] Automated tests for server endpoints and hook handler.

## P3 — nice-to-have / later

- [ ] WebSocket upgrade (replace SSE+POST with bi-directional).
- [ ] Command history persisted across reloads (localStorage).
- [ ] Keyboard shortcuts for pause/export/tab-switch.
- [ ] Dark/light mode toggle.
- [ ] Export format options (JSON, Markdown report, HTML timeline).
- [ ] Replay mode — load an exported .jsonl and replay at configurable
      speed without needing a live server.

## Known gotchas (non-blocking)

- Hook payload schema may change with future Claude Code versions —
  we rely on `tool_input.file_path`, `tool_input.subagent_type`, etc.
  Defensive fallbacks exist but format drift could still break us.
- `agents/buildcrew.md` Feature-mode enforcement is a prompt-level
  rule, not a hard gate. If Claude ignores it, pipeline skips still
  happen; the dashboard now *shows* the violation via warnings, but
  doesn't block the session.
- `/command` endpoint is unauthenticated on localhost. If users run
  dashboard on a non-localhost interface, anyone on the network could
  drive up API usage. Recommend document "localhost only".

## When ready to ship

1. Fix P0 (1-2h).
2. Merge feat/dashboard → main.
3. Tag v1.9.0.
4. `npm publish` (after `npm login` verified).
5. Cross-post: Twitter/X, r/ClaudeCode, Korean dev communities.
6. Create GitHub issue template for dashboard bug reports.
