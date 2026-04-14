/**
 * TownScene — buildcrew HQ.
 * 16 specialists + 1 team lead, organized into 5 zones + leader seat.
 *
 * Characters: colored circle body + emoji persona face.
 * Zones: soft-colored rectangles behind each team, with zone label.
 * Wake state: subtle up-down bob (walk cycle feel) + glow.
 * File write: paper particle flies toward billboard.
 */

const AGENTS = [
  // Lead (alone at top center)
  { id: "buildcrew",        color: 0xffffff, zone: "Lead",    emoji: "🎩" },
  // Build team
  { id: "planner",          color: 0x7ee0a2, zone: "Build",   emoji: "📋" },
  { id: "designer",         color: 0xf2b24a, zone: "Build",   emoji: "🎨" },
  { id: "developer",        color: 0x5aa9ff, zone: "Build",   emoji: "💻" },
  // Quality team
  { id: "qa-tester",        color: 0xb987f9, zone: "QA",      emoji: "🧪" },
  { id: "browser-qa",       color: 0xcc6fe3, zone: "QA",      emoji: "🌐" },
  { id: "reviewer",         color: 0xff7a8a, zone: "QA",      emoji: "🧐" },
  { id: "health-checker",   color: 0xfbc66e, zone: "QA",      emoji: "🩺" },
  // SecOps
  { id: "security-auditor", color: 0xd94a54, zone: "SecOps",  emoji: "🛡️" },
  { id: "canary-monitor",   color: 0xffb84a, zone: "SecOps",  emoji: "🐤" },
  { id: "shipper",          color: 0x4bd7b2, zone: "SecOps",  emoji: "🚢" },
  // Thinking
  { id: "thinker",          color: 0xd5d8e0, zone: "Think",   emoji: "🤔" },
  { id: "architect",        color: 0x9db7ff, zone: "Think",   emoji: "📐" },
  { id: "design-reviewer",  color: 0xf5a3c7, zone: "Think",   emoji: "👀" },
  // Specialist
  { id: "investigator",     color: 0xe37a4c, zone: "Spec",    emoji: "🕵️" },
  { id: "qa-auditor",       color: 0xa06cd5, zone: "Spec",    emoji: "⚖️" },
];

const ZONE_ORDER = ["Build", "QA", "SecOps", "Think", "Spec"];
const ZONE_STYLE = {
  Lead:   { bg: 0x1a1f2b, label: "TEAM LEAD" },
  Build:  { bg: 0x14221b, label: "BUILD" },
  QA:     { bg: 0x1f1c26, label: "QUALITY" },
  SecOps: { bg: 0x241619, label: "SEC & OPS" },
  Think:  { bg: 0x192033, label: "THINKING" },
  Spec:   { bg: 0x1f1c18, label: "SPECIALIST" },
};

export class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: "TownScene" });
    /** @type {Map<string, any>} */
    this.agents = new Map();
    /** @type {Map<string, any>} */
    this.zones = new Map();
  }

  create() {
    const boardH = this.registry.get("billboardHeight") ?? 0;
    this.boardH = boardH;

    this.bgGraphics = this.add.graphics();
    this.zoneGraphics = this.add.graphics();

    this.title = this.add.text(0, 0, "BUILDCREW HQ", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      color: "#5d6578",
      letterSpacing: 3,
    });

    this.layout();

    this.scale.on("resize", (g) => {
      this.cameras.resize(g.width, g.height);
      this.layout();
    });
  }

  layout() {
    const w = this.scale.width;
    const h = this.scale.height;
    const boardH = this.boardH;

    // Background dot grid (cleaner than lines)
    this.bgGraphics.clear();
    this.bgGraphics.fillStyle(0x1a1f2b, 0.55);
    const step = 32;
    for (let x = step / 2; x < w; x += step) {
      for (let y = boardH + step / 2; y < h; y += step) {
        this.bgGraphics.fillRect(x, y, 1, 1);
      }
    }

    // Title top-left under billboard
    this.title.setPosition(24, boardH + 12);

    // Lead seat — top center, solo
    const leadY = boardH + 70;
    const leadX = w / 2;
    this.drawZoneBox("Lead", leadX - 110, leadY - 36, 220, 98);
    this.placeAgent("buildcrew", leadX, leadY);

    // 5 zones in columns below
    const zoneStartY = leadY + 100;
    const zoneHeight = h - zoneStartY - 16;
    const zoneWidth = (w - 48) / ZONE_ORDER.length;

    ZONE_ORDER.forEach((zoneName, i) => {
      const zoneMembers = AGENTS.filter((a) => a.zone === zoneName);
      const zx = 24 + i * zoneWidth;
      this.drawZoneBox(zoneName, zx + 6, zoneStartY + 6, zoneWidth - 12, zoneHeight - 12);
      // Place members inside — stacked vertically
      const memberSpacing = (zoneHeight - 60) / Math.max(zoneMembers.length, 1);
      zoneMembers.forEach((spec, j) => {
        const cx = zx + zoneWidth / 2;
        const cy = zoneStartY + 60 + j * memberSpacing;
        this.placeAgent(spec.id, cx, cy);
      });
    });
  }

  drawZoneBox(zoneName, x, y, w, h) {
    const style = ZONE_STYLE[zoneName] ?? { bg: 0x1a1f2b, label: zoneName };
    let zone = this.zones.get(zoneName);
    if (!zone) {
      const rect = this.add.rectangle(x, y, w, h, style.bg, 0.45).setOrigin(0, 0);
      rect.setStrokeStyle(1, 0x2a3042, 0.9);
      const label = this.add.text(x + 10, y + 8, style.label, {
        fontFamily: "ui-monospace, monospace",
        fontSize: "10px",
        fontStyle: "bold",
        color: "#5d6578",
        letterSpacing: 2,
      });
      zone = { rect, label };
      this.zones.set(zoneName, zone);
    } else {
      zone.rect.setPosition(x, y);
      zone.rect.width = w;
      zone.rect.height = h;
      zone.label.setPosition(x + 10, y + 8);
    }
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
      agent.homeX = x;
      agent.homeY = y;
    }
  }

  createAgent(spec, x, y) {
    const radius = 24;
    const container = this.add.container(x, y);

    // Glow ring (hidden when idle)
    const glow = this.add.circle(0, 0, radius + 10, spec.color, 0.25);
    glow.setVisible(false);
    container.add(glow);

    // Body
    const body = this.add.circle(0, 0, radius, spec.color);
    body.setStrokeStyle(2, 0x0b0d12);
    container.add(body);

    // Emoji face
    const emoji = this.add.text(0, 0, spec.emoji, {
      fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
      fontSize: "24px",
    }).setOrigin(0.5);
    container.add(emoji);

    // Name below
    const name = this.add.text(0, radius + 8, spec.id, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#8a93a7",
    }).setOrigin(0.5, 0);
    container.add(name);

    // Speech bubble (hidden)
    const bubbleBg = this.add.rectangle(0, -radius - 22, 160, 30, 0x12151c, 0.95);
    bubbleBg.setStrokeStyle(1, 0x3a4156);
    bubbleBg.setVisible(false);
    container.add(bubbleBg);
    const bubbleText = this.add.text(0, -radius - 22, "", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#e8ecf4",
      align: "center",
      wordWrap: { width: 150 },
    }).setOrigin(0.5);
    bubbleText.setVisible(false);
    container.add(bubbleText);

    return {
      spec, container, body, glow, emoji, name, bubbleBg, bubbleText,
      homeX: x, homeY: y,
      state: "idle",
      bobTween: null,
    };
  }

  // -------- scene actions (called by dispatcher) --------

  wake(agentId, message) {
    const a = this.agents.get(agentId);
    if (!a) return;
    a.state = "wake";
    a.glow.setVisible(true);
    a.glow.setAlpha(0.25);
    this.tweens.killTweensOf(a.glow);
    this.tweens.add({
      targets: a.glow,
      alpha: { from: 0.45, to: 0.15 },
      yoyo: true,
      repeat: -1,
      duration: 700,
    });
    // Subtle bob (walk cycle feel)
    if (a.bobTween) a.bobTween.stop();
    a.container.y = a.homeY;
    a.bobTween = this.tweens.add({
      targets: a.container,
      y: { from: a.homeY, to: a.homeY - 6 },
      yoyo: true,
      repeat: -1,
      duration: 450,
      ease: "Sine.easeInOut",
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
    this.tweens.add({
      targets: a.container,
      y: a.homeY,
      duration: 180,
      ease: "Cubic.easeOut",
    });
    // Brief check badge
    if (summary) this.showBubble(a, `✓ ${summary}`, 2200);
    else this.hideBubble(a);
    window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "complete" } }));
  }

  fileWritten(agentId, filePath) {
    const a = this.agents.get(agentId);
    if (!a) return;
    const fname = filePath.split("/").pop();
    const note = this.add.text(a.container.x, a.container.y - 10, `📄 ${fname}`, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "11px",
      color: "#7ee0a2",
      backgroundColor: "#0b0d12",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5);

    // Fly toward billboard (upward drift) while fading
    this.tweens.add({
      targets: note,
      y: this.boardH + 10,
      alpha: { from: 1, to: 0 },
      scale: { from: 1, to: 0.8 },
      duration: 1600,
      ease: "Cubic.easeIn",
      onComplete: () => note.destroy(),
    });
  }

  showBubble(a, text, autoHideMs) {
    a.bubbleText.setText(text);
    const padding = 16;
    a.bubbleBg.width = Math.min(200, a.bubbleText.width + padding);
    a.bubbleBg.setVisible(true);
    a.bubbleText.setVisible(true);
    if (autoHideMs) {
      this.time.delayedCall(autoHideMs, () => this.hideBubble(a));
    }
  }
  hideBubble(a) {
    a.bubbleBg.setVisible(false);
    a.bubbleText.setVisible(false);
  }
}
