/**
 * TownScene — renders 16 specialist agents as procedural dot characters.
 * Part A MVP: agents arranged in a 4x4 grid, wake/idle states.
 * Part B: real tilemap + Kenney sprites + walking between zones.
 */

const AGENTS = [
  // Build team
  { id: "planner",        color: 0x7ee0a2, zone: "Build",  label: "PL" },
  { id: "designer",       color: 0xf2b24a, zone: "Build",  label: "DS" },
  { id: "developer",      color: 0x5aa9ff, zone: "Build",  label: "DV" },
  // Quality team
  { id: "qa-tester",      color: 0xb987f9, zone: "QA",     label: "QA" },
  { id: "browser-qa",     color: 0xcc6fe3, zone: "QA",     label: "BQ" },
  { id: "reviewer",       color: 0xff7a8a, zone: "QA",     label: "RV" },
  { id: "health-checker", color: 0xfbc66e, zone: "QA",     label: "HC" },
  // Sec & Ops
  { id: "security-auditor", color: 0xd94a54, zone: "SecOps", label: "SA" },
  { id: "canary-monitor",   color: 0xffb84a, zone: "SecOps", label: "CM" },
  { id: "shipper",          color: 0x4bd7b2, zone: "SecOps", label: "SH" },
  // Thinking
  { id: "thinker",        color: 0xd5d8e0, zone: "Think",  label: "TH" },
  { id: "architect",      color: 0x9db7ff, zone: "Think",  label: "AR" },
  { id: "design-reviewer",color: 0xf5a3c7, zone: "Think",  label: "DR" },
  // Specialist
  { id: "investigator",   color: 0xe37a4c, zone: "Spec",   label: "IN" },
  { id: "qa-auditor",     color: 0xa06cd5, zone: "Spec",   label: "AU" },
  { id: "buildcrew",      color: 0xffffff, zone: "Lead",   label: "LD" },
];

export class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: "TownScene" });
    /** @type {Map<string, AgentSprite>} */
    this.agents = new Map();
  }

  create() {
    const { width, height } = this.scale;
    const boardH = this.registry.get("billboardHeight") ?? 0;

    // Background grid
    this.drawBackground(width, height, boardH);

    // Title
    this.add.text(width / 2, boardH + 20, "BUILDCREW HQ", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "14px",
      color: "#8a93a7",
    }).setOrigin(0.5, 0);

    // Layout agents — 4 cols x 4 rows grid
    this.layoutAgents(width, height, boardH);

    // Resize handler
    this.scale.on("resize", (gameSize) => {
      this.cameras.resize(gameSize.width, gameSize.height);
      this.drawBackground(gameSize.width, gameSize.height, boardH);
      this.layoutAgents(gameSize.width, gameSize.height, boardH);
    });
  }

  drawBackground(w, h, boardH) {
    if (!this.bgGraphics) this.bgGraphics = this.add.graphics();
    this.bgGraphics.clear();
    this.bgGraphics.lineStyle(1, 0x1a1f2b, 0.5);
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      this.bgGraphics.lineBetween(x, boardH, x, h);
    }
    for (let y = boardH; y < h; y += gridSize) {
      this.bgGraphics.lineBetween(0, y, w, y);
    }
  }

  layoutAgents(w, h, boardH) {
    const cols = 4;
    const rows = Math.ceil(AGENTS.length / cols);
    const usableH = h - boardH - 120;
    const cellW = w / cols;
    const cellH = usableH / rows;
    const startY = boardH + 80;

    AGENTS.forEach((spec, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + cellW / 2;
      const y = startY + row * cellH + cellH / 2;

      let agent = this.agents.get(spec.id);
      if (!agent) {
        agent = this.createAgent(spec, x, y);
        this.agents.set(spec.id, agent);
      } else {
        agent.moveTo(x, y);
      }
    });
  }

  createAgent(spec, x, y) {
    const radius = 26;
    const container = this.add.container(x, y);

    // Glow (wake state only, hidden initially)
    const glow = this.add.circle(0, 0, radius + 8, spec.color, 0.3);
    glow.setVisible(false);
    container.add(glow);

    // Body
    const body = this.add.circle(0, 0, radius, spec.color);
    body.setStrokeStyle(2, 0x0b0d12);
    container.add(body);

    // Label
    const label = this.add.text(0, 0, spec.label, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#0b0d12",
    }).setOrigin(0.5);
    container.add(label);

    // Name below
    const name = this.add.text(0, radius + 10, spec.id, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#8a93a7",
    }).setOrigin(0.5, 0);
    container.add(name);

    // Speech bubble (hidden)
    const bubbleBg = this.add.rectangle(0, -radius - 24, 140, 28, 0x232836, 0.95);
    bubbleBg.setStrokeStyle(1, 0x3a4156);
    bubbleBg.setVisible(false);
    container.add(bubbleBg);
    const bubbleText = this.add.text(0, -radius - 24, "", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      color: "#e8ecf4",
      align: "center",
      wordWrap: { width: 130 },
    }).setOrigin(0.5);
    bubbleText.setVisible(false);
    container.add(bubbleText);

    return {
      spec,
      container,
      body,
      glow,
      label,
      name,
      bubbleBg,
      bubbleText,
      state: "idle",
      moveTo(x, y) { container.setPosition(x, y); },
    };
  }

  // -------- scene actions (called by dispatcher) --------

  wake(agentId, message) {
    const a = this.agents.get(agentId);
    if (!a) return;
    a.state = "wake";
    a.glow.setVisible(true);
    this.tweens.killTweensOf(a.container);
    this.tweens.add({
      targets: a.container,
      scale: { from: 1, to: 1.15 },
      yoyo: true,
      repeat: -1,
      duration: 400,
      ease: "Sine.easeInOut",
    });
    this.showBubble(a, message ?? "working…");
  }

  idle(agentId, summary) {
    const a = this.agents.get(agentId);
    if (!a) return;
    a.state = "idle";
    a.glow.setVisible(false);
    this.tweens.killTweensOf(a.container);
    this.tweens.add({
      targets: a.container,
      scale: 1,
      duration: 200,
    });
    // Flash a check badge
    if (summary) this.showBubble(a, `✓ ${summary}`, 2000);
    else this.hideBubble(a);
  }

  fileWritten(agentId, filePath) {
    const a = this.agents.get(agentId);
    if (!a) return;
    // Particle: text that floats up
    const note = this.add.text(
      a.container.x,
      a.container.y - 20,
      `📄 ${filePath.split("/").pop()}`,
      {
        fontFamily: "ui-monospace, monospace",
        fontSize: "11px",
        color: "#7ee0a2",
        backgroundColor: "#12151c",
        padding: { x: 4, y: 2 },
      }
    ).setOrigin(0.5);
    this.tweens.add({
      targets: note,
      y: note.y - 40,
      alpha: 0,
      duration: 1800,
      ease: "Cubic.easeOut",
      onComplete: () => note.destroy(),
    });
  }

  showBubble(a, text, autoHideMs) {
    a.bubbleText.setText(text);
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
