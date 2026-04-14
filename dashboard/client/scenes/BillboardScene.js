/**
 * BillboardScene — top banner with news ticker for important events.
 * Shows pipeline.stage cards + issue.found tickers.
 */

const COLORS = {
  stage: { bg: 0x1a2432, text: "#7ee0a2", accent: 0x7ee0a2 },
  low:   { bg: 0x1a2432, text: "#8a93a7", accent: 0x8a93a7 },
  med:   { bg: 0x2a2318, text: "#f2b24a", accent: 0xf2b24a },
  high:  { bg: 0x2a2318, text: "#f2b24a", accent: 0xf2b24a },
  critical: { bg: 0x2a0c10, text: "#ff5a63", accent: 0xff5a63 },
};

export class BillboardScene extends Phaser.Scene {
  constructor() {
    super({ key: "BillboardScene" });
    this.items = [];     // active ticker items
  }

  create() {
    const h = this.registry.get("billboardHeight") ?? 72;
    this.boardH = h;
    const w = this.scale.width;

    // Background strip
    this.bg = this.add.rectangle(0, 0, w, h, 0x12151c).setOrigin(0, 0);
    this.bg.setStrokeStyle(1, 0x232836);

    // "NOW" marker left side
    this.add.text(16, h / 2, "◉ LIVE", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      color: "#ff5a63",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);

    // Current stage display (right side of NOW)
    this.stageText = this.add.text(100, h / 2, "— idle —", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "14px",
      color: "#8a93a7",
    }).setOrigin(0, 0.5);

    this.tickerX = w; // items start off-screen right and scroll left

    this.scale.on("resize", (s) => {
      this.bg.width = s.width;
    });
  }

  // -------- actions called by dispatcher --------

  stage(name) {
    this.stageText.setText(`▶ ${name.toUpperCase()}`);
    this.stageText.setColor("#7ee0a2");
    // brief pulse
    this.tweens.add({
      targets: this.stageText,
      scale: { from: 1.2, to: 1 },
      duration: 300,
      ease: "Back.easeOut",
    });
  }

  issue(severity, title) {
    const c = COLORS[severity] ?? COLORS.med;
    const txt = this.add.text(
      this.scale.width + 20,
      this.boardH / 2,
      `⚠ ${severity.toUpperCase()} · ${title}`,
      {
        fontFamily: "ui-monospace, monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: c.text,
        backgroundColor: `#${c.bg.toString(16).padStart(6, "0")}`,
        padding: { x: 10, y: 4 },
      }
    ).setOrigin(0, 0.5);

    // Scroll right → left
    const dur = severity === "critical" ? 12000 : 16000;
    this.tweens.add({
      targets: txt,
      x: -txt.width - 40,
      duration: dur,
      ease: "Linear",
      onComplete: () => txt.destroy(),
    });

    // Flash for critical
    if (severity === "critical") {
      this.tweens.add({
        targets: txt,
        alpha: { from: 1, to: 0.3 },
        yoyo: true,
        repeat: 6,
        duration: 250,
      });
    }
  }
}
