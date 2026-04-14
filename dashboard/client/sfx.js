/**
 * Procedural sound effects via Web Audio API.
 * No audio files — all tones generated from OscillatorNode + envelope.
 *
 * Listens for custom DOM event: "dashboard:sfx" with detail.kind
 * Kinds: dispatch | complete | stage | critical | warning
 *
 * Muted by default until user clicks anywhere (browser autoplay policy).
 * Toggle button in UI flips mute state.
 */

let ctx = null;
let muted = true;
let unlocked = false;

const PRESETS = {
  // Agent dispatched — short rising blip
  dispatch:  { freq: 680, end: 920, dur: 0.08, gain: 0.06, type: "sine" },
  // Agent completed — warm two-note resolve
  complete:  { freq: 520, end: 780, dur: 0.18, gain: 0.08, type: "triangle" },
  // Pipeline stage change — big synth chord
  stage:     { freq: 330, end: 440, dur: 0.35, gain: 0.12, type: "sawtooth", chord: true },
  // Critical issue — harsh buzzer
  critical:  { freq: 220, end: 180, dur: 0.35, gain: 0.16, type: "square", repeat: 3 },
  // High/medium issue — single warn beep
  warning:   { freq: 480, end: 380, dur: 0.22, gain: 0.10, type: "square" },
};

export function setupSfx() {
  // Unlock audio on first user gesture (autoplay policy)
  const unlock = () => {
    if (unlocked) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      unlocked = true;
      muted = false; // default on after unlock
      updateToggle();
    } catch (e) {
      console.warn("[sfx] audio unavailable:", e);
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock);

  // Listen for SFX events from scenes
  window.addEventListener("dashboard:sfx", (e) => {
    if (muted || !ctx) return;
    const kind = e.detail?.kind;
    const preset = PRESETS[kind];
    if (preset) play(preset);
  });

  // Toggle button in statusbar
  injectToggle();
}

function play(p) {
  const now = ctx.currentTime;
  const playOne = (offset = 0, freqMul = 1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq * freqMul, now + offset);
    osc.frequency.exponentialRampToValueAtTime(p.end * freqMul, now + offset + p.dur);
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(p.gain, now + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + p.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + p.dur + 0.05);
  };

  if (p.repeat) {
    for (let i = 0; i < p.repeat; i++) playOne(i * (p.dur + 0.08));
  } else if (p.chord) {
    playOne(0, 1);
    playOne(0, 1.25);     // major third
    playOne(0, 1.5);      // perfect fifth
  } else {
    playOne();
  }
}

function injectToggle() {
  const bar = document.getElementById("statusbar");
  if (!bar) return;
  const btn = document.createElement("button");
  btn.id = "sfx-toggle";
  btn.style.cssText = "background:none;border:1px solid #232836;color:inherit;font:inherit;padding:2px 8px;border-radius:4px;cursor:pointer;";
  btn.textContent = "🔇 click to enable sfx";
  btn.onclick = () => {
    if (!unlocked) return; // will auto-unlock on click anyway
    muted = !muted;
    updateToggle();
  };
  bar.insertBefore(btn, bar.firstChild);

  const observer = setInterval(updateToggle, 500);
  window._sfxObserver = observer;
}

function updateToggle() {
  const btn = document.getElementById("sfx-toggle");
  if (!btn) return;
  if (!unlocked) btn.textContent = "🔇 click anywhere to enable sfx";
  else if (muted) btn.textContent = "🔇 sfx muted (click to unmute)";
  else btn.textContent = "🔊 sfx on (click to mute)";
}
