/**
 * Command bar — replaces the terminal as the primary input surface.
 *
 * Sends prompts to POST /command, which spawns `claude -p` on the server.
 * Output streams back via /command-stream SSE into the Terminal tab.
 *
 * UX:
 *   - Enter to send, ↑/↓ for history
 *   - Only one command active at a time (server enforces)
 *   - Auto-focus input after command finishes
 *   - Rate-limit error → toast, re-enable input
 */

import { toast } from "./modals.js";

export function mountCommand({ logPanel }) {
  const input = document.getElementById("cmd-input");
  const sendBtn = document.getElementById("cmd-send");
  const status = document.getElementById("cmd-status");

  const state = {
    running: false,
    history: [],
    historyIdx: -1,
    currentId: null,
  };

  setRunning(false);

  // Subscribe to /command-stream for server-side command events
  const es = new EventSource("/command-stream");

  es.onmessage = (msg) => {
    let ev;
    try { ev = JSON.parse(msg.data); } catch { return; }

    if (ev.type === "command.active" || ev.type === "command.started") {
      state.currentId = ev.id;
      setRunning(true);
      if (ev.type === "command.started") {
        logPanel?.pushTerminal({ kind: "meta", text: `❯ ${ev.prompt}` });
      } else {
        logPanel?.pushTerminal({ kind: "meta", text: `(resumed watching ${ev.id})` });
      }
      return;
    }

    if (ev.type === "command.out") {
      logPanel?.pushTerminal({ kind: "out", payload: ev.payload });
      return;
    }

    if (ev.type === "command.stderr") {
      logPanel?.pushTerminal({ kind: "err", text: ev.line });
      // Detect rate limit phrases
      if (/rate.?limit|too many requests|429/i.test(ev.line)) {
        toast("rate limit — 잠시 후 재시도");
      }
      return;
    }

    if (ev.type === "command.finished") {
      logPanel?.pushTerminal({ kind: "meta", text: `✓ finished (${ev.exit_code}, ${ev.duration_s}s)` });
      state.currentId = null;
      setRunning(false);
      return;
    }

    if (ev.type === "command.error") {
      logPanel?.pushTerminal({ kind: "err", text: `ERROR: ${ev.message}` });
      toast(`command failed: ${ev.message}`);
      state.currentId = null;
      setRunning(false);
      return;
    }
  };

  es.onerror = () => {
    // SSE will auto-reconnect; log softly
    console.warn("[command] /command-stream disconnected, retrying…");
  };

  // --- input handling ---

  sendBtn.addEventListener("click", send);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
      return;
    }
    if (e.key === "ArrowUp" && !state.running) {
      e.preventDefault();
      if (state.history.length === 0) return;
      state.historyIdx = Math.min(state.historyIdx + 1, state.history.length - 1);
      input.value = state.history[state.historyIdx];
      // Move cursor to end
      setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
      return;
    }
    if (e.key === "ArrowDown" && state.historyIdx > -1) {
      e.preventDefault();
      state.historyIdx--;
      input.value = state.historyIdx >= 0 ? state.history[state.historyIdx] : "";
      return;
    }
  });

  async function send() {
    if (state.running) return;
    const prompt = input.value.trim();
    if (!prompt) return;
    state.history.unshift(prompt);
    state.historyIdx = -1;
    input.value = "";
    setRunning(true);

    try {
      const r = await fetch("/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        toast(`start failed: ${err.error}`);
        setRunning(false);
      }
      // Success path: /command-stream will drive UI updates via command.started
    } catch (err) {
      toast(`network error: ${err.message}`);
      setRunning(false);
    }
  }

  function setRunning(isRunning) {
    state.running = isRunning;
    input.disabled = isRunning;
    sendBtn.disabled = isRunning;
    sendBtn.textContent = isRunning ? "…" : "RUN";
    status.textContent = isRunning ? "running" : "idle";
    status.classList.toggle("running", isRunning);
    if (!isRunning) input.focus();
  }

  // Initial focus
  input.focus();
}
