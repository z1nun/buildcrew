/**
 * BillboardScene — top banner.
 * - Left: "◉ LIVE" marker
 * - Center: current pipeline stage
 * - Right→Left: news ticker for issue.found events, severity-tiered
 * On stage() call, flashes full-screen overlay with large stage name for ~1.2s.
 */

const COLORS = {
  stage: { text: "#7ee0a2" },
  low:   { bg: 0x1a2432, text: "#8a93a7" },
  med:   { bg: 0x2a2318, text: "#f2b24a" },
  high:  { bg: 0x2a2318, text: "#f2b24a" },
  critical: { bg: 0x2a0c10, text: "#ff5a63" },
};

export class BillboardScene extends Phaser.Scene {
  constructor() {
    super({ key: "BillboardScene" });
  }

  create() {
    const h = this.registry.get("billboardHeight") ?? 72;
    this.boardH = h;
    const w = this.scale.width;

    // Background strip
    this.bg = this.add.rectangle(0, 0, w, h, 0x12151c).setOrigin(0, 0);
    this.bg.setStrokeStyle(1, 0x232836);

    // Live marker
    this.add.text(16, h / 2, "◉ LIVE", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      color: "#ff5a63",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);

    // Current stage
    this.stageText = this.add.text(90, h / 2, "— idle —", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "14px",
      color: "#8a93a7",
    }).setOrigin(0, 0.5);

    this.scale.on("resize", (s) => {
      this.bg.width = s.width;
    });
  }

  // -------- actions called by dispatcher --------

  stage(name) {
    const label = name.toUpperCase();
    this.stageText.setText(`▶ ${label}`);
    this.stageText.setColor("#7ee0a2");

    // Full-screen flash overlay
    const w = this.scale.width;
    const h = this.scale.height;
    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0).setOrigin(0, 0).setDepth(100);
    const bigText = this.add.text(w / 2, h / 2, label, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "96px",
      fontStyle: "bold",
      color: "#7ee0a2",
    }).setOrigin(0.5).setAlpha(0).setScale(1.3).setDepth(101);

    this.tweens.add({
      targets: overlay,
      alpha: { from: 0, to: 0.55 },
      yoyo: true,
      duration: 500,
      onComplete: () => overlay.destroy(),
    });
    this.tweens.add({
      targets: bigText,
      alpha: { from: 0, to: 1 },
      scale: { from: 1.3, to: 1 },
      duration: 400,
      ease: "Back.easeOut",
    });
    this.time.delayedCall(700, () => {
      this.tweens.add({
        targets: bigText,
        alpha: 0,
        scale: 0.85,
        duration: 350,
        ease: "Cubic.easeIn",
        onComplete: () => bigText.destroy(),
      });
    });

    window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "stage" } }));
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

    const dur = severity === "critical" ? 12000 : 16000;
    this.tweens.add({
      targets: txt,
      x: -txt.width - 40,
      duration: dur,
      ease: "Linear",
      onComplete: () => txt.destroy(),
    });

    if (severity === "critical") {
      this.tweens.add({
        targets: txt,
        alpha: { from: 1, to: 0.3 },
        yoyo: true,
        repeat: 6,
        duration: 250,
      });
      window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "critical" } }));
    } else if (severity === "high") {
      window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "warning" } }));
    }
  }
}
