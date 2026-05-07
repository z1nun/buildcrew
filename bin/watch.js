#!/usr/bin/env node
/**
 * buildcrew watch — terminal-native live monitor.
 *
 * Tails .claude/buildcrew/events.jsonl (written by the CC hook) and renders
 * a compact live status pane in the user's terminal. Zero runtime deps —
 * just ANSI + node:fs.
 *
 * This file is a thin orchestrator. The work lives in lib/watch/:
 *   - state.js  — events.jsonl parser, coherence loader, file tailing
 *   - render.js — ANSI palette + frame composition (read-only over state)
 *   - input.js  — alt-screen + keyboard handling
 *
 * Usage:  npx buildcrew watch
 * Exit with q or Ctrl-C.
 */

import {
  AGENTS, STAGES,
  createState,
  ensureEventsFile, eventsPath,
  loadLatestCoherence,
  replayExisting, subscribeTail,
} from "../lib/watch/state.js";
import { render, scheduleRender, setRenderer } from "../lib/watch/render.js";
import { enterAltScreen, installExitHandlers, installKeypressHandlers } from "../lib/watch/input.js";

const state = createState();
const path = eventsPath();
const offset = { tailOffset: 0 };

// Wire the render scheduler to a closure that always sees the current state.
// state.js's onChange callbacks call scheduleRender(), which calls this.
setRenderer(() => render(state, { AGENTS, STAGES }));

const onChange = scheduleRender;
const loadCoherence = () => loadLatestCoherence(state, { onChange });

// ------------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------------
const restoreTerm = enterAltScreen();
installExitHandlers(restoreTerm);
installKeypressHandlers();

// Heartbeat redraw (updates elapsed even without events)
setInterval(scheduleRender, 1000);

// Tail the events.jsonl — replay history then watch for new lines
(async () => {
  await ensureEventsFile(path);
  const replayResult = await replayExisting(state, path, { onChange, loadCoherence });
  offset.tailOffset = replayResult.tailOffset;
  // Surface the latest coherence report (if any) on startup, even before any
  // new events fire — so users see their last score when they open watch.
  loadCoherence();
  subscribeTail(state, path, offset, { onChange, loadCoherence });
  scheduleRender();
})();
