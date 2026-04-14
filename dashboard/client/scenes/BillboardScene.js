/**
 * BillboardScene — cozy wood header bar.
 * "🏠 BUILDCREW TOWN · stage · notifications · ticker"
 */

const PALETTE = {
  wood:      0x8b6f47,
  woodDark:  0x5c4a30,
  woodLight: 0xc9a876,
  cream:     0xf5ebd7,
  creamMuted: 0xb8a88c,
  ok:        0xa8d994,
  warn:      0xf2b24a,
  crit:      0xff8566,
};

export class BillboardScene extends Phaser.Scene {
  constructor() { super({ key: "BillboardScene" }); }

  create() {
    const h = this.registry.get("billboardHeight") ?? 72;
    this.boardH = h;
    const w = this.scale.width;

    // Wood header
    this.bg = this.add.rectangle(0, 0, w, h, PALETTE.wood).setOrigin(0, 0);
    this.bg.setStrokeStyle(0);

    // Wood grain effect (a few horizontal lines)
    this.grain = this.add.graphics();
    this.drawGrain(w, h);

    // Bottom accent stripe (darker wood)
    this.accent = this.add.rectangle(0, h - 3, w, 3, PALETTE.woodDark).setOrigin(0, 0);

    // Title
    this.title = this.add.text(20, h / 2, "🏠 BUILDCREW TOWN", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f5ebd7",
    }).setOrigin(0, 0.5);

    // Stage pill
    this.stagePillBg = this.add.rectangle(0, h / 2, 140, 26, PALETTE.woodDark).setOrigin(0, 0.5);
    this.stagePillBg.setStrokeStyle(1, PALETTE.woodLight);
    this.stageText = this.add.text(0, h / 2, "idle", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#c9a876",
    }).setOrigin(0, 0.5);

    // Notification badge (right side)
    this.notifBg = this.add.rectangle(0, h / 2, 60, 24, PALETTE.woodDark).setOrigin(0, 0.5);
    this.notifBg.setStrokeStyle(1, PALETTE.woodLight);
    this.notifText = this.add.text(0, h / 2, "🔔 0", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "12px",
      color: "#f5ebd7",
    }).setOrigin(0.5);
    this.activeCount = 0;

    this.positionHeaderChildren(w);

    this.scale.on("resize", (s) => {
      this.bg.width = s.width;
      this.accent.width = s.width;
      this.drawGrain(s.width, h);
      this.positionHeaderChildren(s.width);
    });

    // Track active count via sfx events (simple heuristic)
    window.addEventListener("dashboard:sfx", (e) => {
      if (e.detail?.kind === "dispatch") this.bumpNotif(1);
      else if (e.detail?.kind === "complete") this.bumpNotif(-1);
    });
  }

  drawGrain(w, h) {
    this.grain.clear();
    this.grain.lineStyle(1, PALETTE.woodDark, 0.3);
    for (let y = 8; y < h - 6; y += 6) {
      this.grain.lineBetween(0, y, w, y);
    }
  }

  positionHeaderChildren(w) {
    const h = this.boardH;
    const titleRight = this.title.x + this.title.width + 16;
    this.stagePillBg.setPosition(titleRight, h / 2);
    this.stageText.setPosition(titleRight + 10, h / 2);

    // Notifications on right
    const notifW = 70;
    this.notifBg.setPosition(w - 20 - notifW, h / 2);
    this.notifText.setPosition(w - 20 - notifW / 2, h / 2);
  }

  bumpNotif(delta) {
    this.activeCount = Math.max(0, this.activeCount + delta);
    this.notifText.setText(`🔔 ${this.activeCount}`);
    if (delta > 0) {
      this.tweens.add({
        targets: this.notifText,
        scale: { from: 1.3, to: 1 },
        duration: 250,
        ease: "Back.easeOut",
      });
    }
  }

  // ---- actions ----

  stage(name) {
    const label = name.toUpperCase();
    this.stageText.setText(label);
    this.stageText.setColor("#a8d994");

    // Resize stage pill to fit
    this.stagePillBg.width = this.stageText.width + 20;
    this.positionHeaderChildren(this.scale.width);

    // Full-screen softer flash (cozy, not harsh)
    const w = this.scale.width;
    const h = this.scale.height;
    const overlay = this.add.rectangle(0, 0, w, h, 0x8b6f47, 0).setOrigin(0, 0).setDepth(100);
    const bigText = this.add.text(w / 2, h / 2, label, {
      fontFamily: "ui-monospace, monospace",
      fontSize: "84px",
      fontStyle: "bold",
      color: "#f5ebd7",
    }).setOrigin(0.5).setAlpha(0).setScale(1.2).setDepth(101);
    const subText = this.add.text(w / 2, h / 2 + 60, "new chapter", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "14px",
      color: "#c9a876",
    }).setOrigin(0.5).setAlpha(0).setDepth(101);

    this.tweens.add({
      targets: overlay,
      alpha: { from: 0, to: 0.28 },
      yoyo: true,
      duration: 600,
      onComplete: () => overlay.destroy(),
    });
    this.tweens.add({
      targets: [bigText, subText],
      alpha: { from: 0, to: 1 },
      scale: { from: 1.15, to: 1 },
      duration: 400,
      ease: "Back.easeOut",
    });
    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets: [bigText, subText],
        alpha: 0,
        scale: 0.85,
        duration: 350,
        ease: "Cubic.easeIn",
        onComplete: () => { bigText.destroy(); subText.destroy(); },
      });
    });

    window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "stage" } }));
  }

  issue(severity, title) {
    const colorMap = { low: "#c9a876", med: "#f2b24a", high: "#f2b24a", critical: "#ff8566" };
    const bgMap =   { low: 0x3c342c, med: 0x3c2818, high: 0x3c2818, critical: 0x4a1c18 };
    const c = colorMap[severity] ?? "#c9a876";
    const bg = bgMap[severity] ?? 0x3c342c;

    const txt = this.add.text(
      this.scale.width + 20,
      this.boardH / 2,
      `⚠ ${severity.toUpperCase()} · ${title}`,
      {
        fontFamily: "ui-monospace, monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: c,
        backgroundColor: `#${bg.toString(16).padStart(6, "0")}`,
        padding: { x: 10, y: 4 },
      }
    ).setOrigin(0, 0.5);

    const dur = severity === "critical" ? 13000 : 17000;
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
        alpha: { from: 1, to: 0.35 },
        yoyo: true,
        repeat: 5,
        duration: 280,
      });
      window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "critical" } }));
    } else if (severity === "high") {
      window.dispatchEvent(new CustomEvent("dashboard:sfx", { detail: { kind: "warning" } }));
    }
  }
}
