/**
 * Dashboard client entry.
 */

import { TownScene } from "./scenes/TownScene.js";
import { BillboardScene } from "./scenes/BillboardScene.js";
import { StageLadderScene } from "./scenes/StageLadderScene.js";
import { MetricsTimelineScene } from "./scenes/MetricsTimelineScene.js";
import { attachDispatcher } from "./events/dispatcher.js";
import { setupSfx } from "./sfx.js";
import { mountLogPanel } from "./logpanel.js";

setupSfx();
const logPanel = mountLogPanel();

const BILLBOARD_H = 60;
const LADDER_H = 68;
const STRIP_H = 170;

const stageEl = document.getElementById("stage");

const config = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#2a2420",
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: "app",
    width: stageEl.clientWidth,
    height: stageEl.clientHeight,
  },
  scene: [TownScene, BillboardScene, StageLadderScene, MetricsTimelineScene],
  render: { pixelArt: true, antialias: false },
  physics: { default: "arcade" },
};

const game = new Phaser.Game(config);

function updateLayout() {
  const h = stageEl.clientHeight;
  game.registry.set("billboardHeight", BILLBOARD_H);
  game.registry.set("ladderY", BILLBOARD_H);
  game.registry.set("ladderH", LADDER_H);
  game.registry.set("townTopY", BILLBOARD_H + LADDER_H);
  game.registry.set("townBottomY", h - STRIP_H);
  game.registry.set("stripY", h - STRIP_H);
  game.registry.set("stripH", STRIP_H);
}
updateLayout();
window.addEventListener("resize", updateLayout);

// Wire SSE once scenes are active. Safety net: if any scene fails to boot
// within 3 seconds, still connect SSE so the log panel works.
let attached = false;
const wire = () => {
  if (attached) return;
  attached = true;
  const town = game.scene.getScene("TownScene");
  const board = game.scene.getScene("BillboardScene");
  attachDispatcher({ town, board, ui: uiRefs(), logPanel });
};
const readyTimer = setInterval(() => {
  const scenes = ["TownScene", "BillboardScene", "StageLadderScene", "MetricsTimelineScene"]
    .map((k) => game.scene.getScene(k));
  const allActive = scenes.every((s) => s && s.scene.isActive());
  if (allActive) {
    clearInterval(readyTimer);
    wire();
  }
}, 50);
setTimeout(() => {
  if (!attached) {
    console.warn("[dashboard] scenes not all active after 3s — wiring SSE anyway");
    clearInterval(readyTimer);
    wire();
  }
}, 3000);

function uiRefs() {
  return {
    conn: document.getElementById("conn"),
    count: document.getElementById("count"),
  };
}
