/**
 * Dashboard client entry.
 * Boots Phaser with TownScene (agents) + BillboardScene (news ticker).
 * Wires SSE → dispatcher → scene events.
 */

import { TownScene } from "./scenes/TownScene.js";
import { BillboardScene } from "./scenes/BillboardScene.js";
import { attachDispatcher } from "./events/dispatcher.js";

const BILLBOARD_H = 72;

const config = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#0b0d12",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [TownScene, BillboardScene],
  physics: { default: "arcade" },
};

const game = new Phaser.Game(config);
game.registry.set("billboardHeight", BILLBOARD_H);

// Wire SSE once scenes are created
game.events.once("ready", () => {
  const town = game.scene.getScene("TownScene");
  const board = game.scene.getScene("BillboardScene");
  attachDispatcher({ town, board, ui: uiRefs() });
});

// Phaser doesn't emit "ready" natively — poll until both scenes are active
const readyTimer = setInterval(() => {
  const town = game.scene.getScene("TownScene");
  const board = game.scene.getScene("BillboardScene");
  if (town?.scene.isActive() && board?.scene.isActive()) {
    clearInterval(readyTimer);
    game.events.emit("ready");
  }
}, 50);

function uiRefs() {
  return {
    conn: document.getElementById("conn"),
    count: document.getElementById("count"),
  };
}
