/**
 * TownScene — pixel-art top-down office (Gather Town feel).
 *
 * Floor: TileSprite per room with a procedurally generated 16×16 pixel texture
 *        (carpet / wood / stone / grass depending on room mood).
 * Walls: wood-tone rounded frame around each room with a nameplate.
 * Characters: procedurally drawn 24×32 pixel chunky sprites (colored body + hat
 *             + highlight/shadow) with an emoji face overlaid. Click-to-select.
 */

import { buildPixelTextures, roomFloorKey, makeCharacter } from "../pixelart.js";

const PALETTE = {
  bg:        0x2a2420,
  wood:      0x8b6f47,
  woodDark:  0x5c4a30,
  woodLight: 0xc9a876,
  cream:     0xf5ebd7,
  creamMuted: 0xb8a88c,
  gold:      0xffd966,
};

const AGENTS = [
  { id: "buildcrew",        room: "Meeting",   color: 0xffffff, emoji: "🎩" },
  { id: "planner",          room: "Meeting",   color: 0x7ee0a2, emoji: "📋" },
  { id: "designer",         room: "Meeting",   color: 0xf2b24a, emoji: "🎨" },
  { id: "developer",        room: "Meeting",   color: 0x5aa9ff, emoji: "💻" },
  { id: "qa-tester",        room: "QA Lab",    color: 0xb987f9, emoji: "🧪" },
  { id: "browser-qa",       room: "QA Lab",    color: 0xcc6fe3, emoji: "🌐" },
  { id: "reviewer",         room: "QA Lab",    color: 0xff8a9a, emoji: "🧐" },
  { id: "health-checker",   room: "QA Lab",    color: 0xfbc66e, emoji: "🩺" },
  { id: "security-auditor", room: "SecOps",    color: 0xe67a84, emoji: "🛡️" },
  { id: "canary-monitor",   room: "SecOps",    color: 0xffc87a, emoji: "🐤" },
  { id: "shipper",          room: "SecOps",    color: 0x70d7b2, emoji: "🚢" },
  { id: "thinker",          room: "Think Tank",color: 0xd5d8e0, emoji: "🤔" },
  { id: "architect",        room: "Think Tank",color: 0x9db7ff, emoji: "📐" },
  { id: "design-reviewer",  room: "Think Tank",color: 0xf5a3c7, emoji: "👀" },
  { id: "investigator",     room: "Field",     color: 0xe37a4c, emoji: "🕵️" },
  { id: "qa-auditor",       room: "Field",     color: 0xa06cd5, emoji: "⚖️" },
];

const ROOMS = {
  "Meeting":    { grid: [0, 0, 7, 5], icon: "☕" },
  "QA Lab":     { grid: [7, 0, 5, 5], icon: "🔬" },
  "SecOps":     { grid: [0, 5, 4, 5], icon: "🛡" },
  "Think Tank": { grid: [4, 5, 5, 5], icon: "💭" },
  "Field":      { grid: [9, 5, 3, 5], icon: "📍" },
};

export class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: "TownScene", active: true });
    this.agents = new Map();
    this.rooms = new Map();
    this.roomTileSprites = new Map();
  }

  preload() {
    // Build procedural pixel textures before create()
    buildPixelTextures(this.textures);
    // Register a unique character sprite per agent color
    for (const spec of AGENTS) {
      const key = charKey(spec.color);
      if (!this.textures.exists(key)) {
        this.textures.addCanvas(key, makeCharacter(spec.color));
      }
    }
  }

  create() {
    this.wallGraphics = this.add.graphics();
    this.outsideBg = this.add.tileSprite(0, 0, 10, 10, "tile-check");
    this.outsideBg.setOrigin(0, 0);
    this.outsideBg.setAlpha(0.7);
    // Redundant title removed — billboard already shows "🏠 BUILDCREW TOWN"

    this.layout();

    this.scale.on("resize", (g) => {
      this.cameras.resize(g.width, g.height);
      this.layout();
    });
    this.registry.events.on("changedata", () => this.layout());
  }

  layout() {
    const w = this.scale.width;
    const topY = this.registry.get("townTopY") ?? 140;
    const botY = this.registry.get("townBottomY") ?? this.scale.height;
    this.topY = topY;
    this.botY = botY;

    // Outside (hallway) background — subtle checker
    this.outsideBg.setPosition(0, topY);
    this.outsideBg.width = w;
    this.outsideBg.height = botY - topY;

    // Clear wall outlines
    this.wallGraphics.clear();

    const areaX = 8;
    const areaY = topY + 8;
    const areaW = w - 16;
    const areaH = botY - topY - 16;
    const gridW = areaW / 12;
    const gridH = areaH / 10;

    for (const [name, spec] of Object.entries(ROOMS)) {
      const [gx, gy, gw, gh] = spec.grid;
      const rx = areaX + gx * gridW + 4;
      const ry = areaY + gy * gridH + 4;
      const rw = gw * gridW - 8;
      const rh = gh * gridH - 8;
      this.drawRoom(name, spec.icon, rx, ry, rw, rh);
    }

    for (const spec of AGENTS) {
      const room = this.rooms.get(spec.room);
      if (!room) continue;
      const slot = nextSlot(room, spec);
      this.placeAgent(spec.id, slot.x, slot.y);
    }
  }

  drawRoom(name, icon, x, y, w, h) {
    // Pixel floor via TileSprite
    let ts = this.roomTileSprites.get(name);
    if (!ts) {
      ts = this.add.tileSprite(x, y, w, h, roomFloorKey(name));
      ts.setOrigin(0, 0);
      this.roomTileSprites.set(name, ts);
    } else {
      ts.setPosition(x, y);
      ts.setSize(w, h);
      ts.setTexture(roomFloorKey(name));
    }
    ts.setDepth(1);

    // Wall border (wood tones, rounded)
    this.wallGraphics.lineStyle(4, PALETTE.wood, 1);
    this.wallGraphics.strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 5);
    this.wallGraphics.lineStyle(1, PALETTE.woodDark, 0.8);
    this.wallGraphics.strokeRoundedRect(x, y, w, h, 4);

    // Nameplate — slim, low-contrast so it doesn't compete with characters
    let room = this.rooms.get(name);
    if (!room) {
      const plateBg = this.add.rectangle(0, 0, 100, 14, 0x2a2420, 0.9).setOrigin(0, 0).setDepth(10);
      plateBg.setStrokeStyle(1, PALETTE.wood, 0.8);
      const plateText = this.add.text(0, 0, `${icon} ${name}`, {
        fontFamily: "ui-monospace, monospace",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#c9a876",
        letterSpacing: 1,
      }).setOrigin(0, 0).setDepth(11);
      room = { plateBg, plateText, bounds: null };
      this.rooms.set(name, room);
    }
    room.plateBg.setPosition(x + 8, y - 7);
    room.plateText.setPosition(x + 14, y - 6);
    room.plateBg.width = room.plateText.width + 12;
    room.bounds = { x, y, w, h };
  }

  placeAgent(agentId, x, y) {
    const spec = AGENTS.find((a) => a.id === agentId);
    if (!spec) return;
    let agent = this.agents.get(agentId);
    if (!agent) {
      agent = this.createAgent(spec, x, y);
      this.agents.set(agentId, agent);
    } else {
      agent.container.setPosition(x, y);
      agent.homeX = x; agent.homeY = y;
    }
  }

  createAgent(spec, x, y) {
    const container = this.add.container(x, y).setDepth(20);

    // Glow (hidden when idle)
    const glow = this.add.circle(0, 2, 20, PALETTE.gold, 0.3);
    glow.setVisible(false);
    container.add(glow);

    // Pixel character sprite (pixelArt rendering is enabled globally)
    const sprite = this.add.image(0, 0, charKey(spec.color));
    sprite.setOrigin(0.5, 0.5);
    sprite.setScale(1.3);
    container.add(sprite);

    // Emoji face (on top of head area)
    const emoji = this.add.text(0, -8, spec.emoji, {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: "14px",
    }).setOrigin(0.5);
    container.add(emoji);

    // Nameplate below
    const name = this.add.text(0, 25, spec.id, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "9px",
      color: "#f5ebd7",
      backgroundColor: "#2a2420",
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 0);
    container.add(name);

    // Bubble — dimensions recomputed per showBubble() call
    const bubbleBg = this.add.rectangle(0, -34, 160, 22, PALETTE.cream, 0.98).setOrigin(0.5);
    bubbleBg.setStrokeStyle(2, PALETTE.woodDark);
    bubbleBg.setVisible(false);
    container.add(bubbleBg);
    const bubbleText = this.add.text(0, -34, "", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#2a2420",
      align: "center",
      wordWrap: { width: 240, useAdvancedWrap: true },
    }).setOrigin(0.5);
    bubbleText.setVisible(false);
    container.add(bubbleText);

    // Clickable
    const hit = new Phaser.Geom.Rectangle(-16, -20, 32, 46);
    container.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    container.on("pointerdown", () => {
      window.dispatchEvent(new CustomEvent("dashboard:agent-select", {
        detail: { agent: spec.id },
      }));
      this.tweens.add({ targets: container, scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 100 });
    });
    container.on("pointerover", () => document.body.style.cursor = "pointer");
    container.on("pointerout", () => document.body.style.cursor = "default");

    return {
      spec, container, sprite, glow, emoji, name, bubbleBg, bubbleText,
      homeX: x, homeY: y, state: "idle", bobTween: null,
    };
  }

  // ---- scene actions ----

  wake(agentId, message) {
    const a = this.agents.get(agentId);
    if (!a) return;
    a.state = "wake";
    a.glow.setVisible(true);
    this.tweens.killTweensOf(a.glow);
    this.tweens.add({
      targets: a.glow,
      alpha: { from: 0.55, to: 0.15 },
      yoyo: true, repeat: -1, duration: 700,
    });
    if (a.bobTween) a.bobTween.stop();
    a.container.y = a.homeY;
    a.bobTween = this.tweens.add({
      targets: a.container,
      y: { from: a.homeY, to: a.homeY - 5 },
      yoyo: true, repeat: -1, duration: 380, ease: "Sine.easeInOut",
    });
    this.showBubble(a, message ?? "working…");
    window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "dispatch" } }));
  }

  idle(agentId, summary) {
    const a = this.agents.get(agentId);
    if (!a) return;
    a.state = "idle";
    this.tweens.killTweensOf(a.glow);
    a.glow.setVisible(false);
    if (a.bobTween) { a.bobTween.stop(); a.bobTween = null; }
    this.tweens.add({ targets: a.container, y: a.homeY, duration: 180 });
    if (summary) this.showBubble(a, `✓ ${summary}`, 2200);
    else this.hideBubble(a);
    window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "complete" } }));
  }

  fileWritten(agentId, filePath) {
    const a = this.agents.get(agentId);
    if (!a) return;
    const fname = filePath.split("/").pop();
    const note = this.add.text(a.container.x, a.container.y - 18, `📄 ${fname}`, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#2a2420",
      backgroundColor: "#c9a876",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: note,
      y: this.topY + 8,
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 0.85 },
      duration: 1700,
      ease: "Cubic.easeIn",
      onComplete: () => note.destroy(),
    });
  }

  showBubble(a, text, autoHideMs) {
    const str = String(text ?? "");
    // Scale bubble width with screen size so small screens don't get gigantic bubbles
    const maxW = Math.min(280, Math.max(140, Math.floor(this.scale.width * 0.28)));
    a.bubbleText.setStyle({ wordWrap: { width: maxW - 16, useAdvancedWrap: true } });
    a.bubbleText.setText(str);

    // After setText, Phaser re-measured height/width. Size bubble to fit snugly.
    const padX = 14;
    const padY = 10;
    const w = Math.min(maxW, Math.ceil(a.bubbleText.width) + padX);
    const h = Math.ceil(a.bubbleText.height) + padY;
    a.bubbleBg.width = w;
    a.bubbleBg.height = h;

    // Stack bubble above character head (character sprite ~32px tall, centered on 0)
    const offsetY = -Math.ceil(h / 2) - 22;
    a.bubbleBg.setPosition(0, offsetY);
    a.bubbleText.setPosition(0, offsetY);

    a.bubbleBg.setVisible(true);
    a.bubbleText.setVisible(true);
    if (autoHideMs) this.time.delayedCall(autoHideMs, () => this.hideBubble(a));
  }
  hideBubble(a) {
    a.bubbleBg.setVisible(false);
    a.bubbleText.setVisible(false);
  }
}

// ---- helpers ----

function charKey(color) {
  return `char-${color.toString(16).padStart(6, "0")}`;
}

function nextSlot(room, spec) {
  const { x, y, w, h } = room.bounds;
  const inset = 28;
  const innerW = w - inset * 2;
  const innerH = h - inset * 2;
  const members = AGENTS.filter((a) => a.room === spec.room);
  const idx = members.findIndex((a) => a.id === spec.id);
  const count = members.length;
  const cols = count >= 4 ? 2 : count >= 3 ? 3 : Math.min(count, 2);
  const rows = Math.ceil(count / cols);
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const cellW = innerW / cols;
  const cellH = innerH / rows;
  return {
    x: x + inset + col * cellW + cellW / 2,
    y: y + inset + row * cellH + cellH / 2,
  };
}
