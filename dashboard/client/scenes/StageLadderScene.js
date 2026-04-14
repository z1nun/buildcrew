/**
 * StageLadderScene — horizontal pipeline progress.
 * Renders PLAN → DESIGN → DEV → QA → REVIEW → SHIP as numbered pills.
 * Status per stage: pending (muted) | active (gold glow + pulse) | done (green check)
 */

import { session, STAGES } from "../state/session.js";

const PALETTE = {
  bgStrip:   0x2a2420,
  pill:      0x3c342c,
  pillDone:  0x3c4a2c,
  pillActive:0x4a3820,
  wood:      0x8b6f47,
  woodDark:  0x5c4a30,
  cream:     0xf5ebd7,
  creamMuted: 0xb8a88c,
  gold:      0xffd966,
  green:     0xa8d994,
};

export class StageLadderScene extends Phaser.Scene {
  constructor() {
    super({ key: "StageLadderScene" });
    this.pills = new Map();
  }

  create() {
    this.ladderY = this.registry.get("ladderY") ?? 72;
    this.ladderH = this.registry.get("ladderH") ?? 80;

    this.bg = this.add.rectangle(0, this.ladderY, this.scale.width, this.ladderH, PALETTE.bgStrip).setOrigin(0, 0);
    this.accentTop = this.add.rectangle(0, this.ladderY, this.scale.width, 1, PALETTE.woodDark).setOrigin(0, 0);
    this.accentBottom = this.add.rectangle(0, this.ladderY + this.ladderH - 1, this.scale.width, 1, PALETTE.woodDark).setOrigin(0, 0);

    // Caption top-left
    this.caption = this.add.text(24, this.ladderY + 10, "PIPELINE", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#b8a88c",
      letterSpacing: 3,
    });
    // Stage counter top-right (e.g., "3 / 6 · DEV")
    this.counter = this.add.text(this.scale.width - 24, this.ladderY + 10, "— / 6", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#b8a88c",
      letterSpacing: 2,
    }).setOrigin(1, 0);

    this.buildPills();
    this.layoutPills();

    this.unsub = session.subscribe(() => this.render());

    this.scale.on("resize", () => {
      this.bg.width = this.scale.width;
      this.accentTop.width = this.scale.width;
      this.accentBottom.width = this.scale.width;
      this.counter.setPosition(this.scale.width - 24, this.ladderY + 10);
      this.layoutPills();
    });
  }

  buildPills() {
    for (let i = 0; i < STAGES.length; i++) {
      const name = STAGES[i];
      const container = this.add.container(0, 0);
      const glow = this.add.rectangle(0, 0, 120, 40, PALETTE.gold, 0).setOrigin(0.5);
      const pill = this.add.rectangle(0, 0, 110, 32, PALETTE.pill, 1).setOrigin(0.5);
      pill.setStrokeStyle(2, PALETTE.wood);
      const numCircle = this.add.circle(-40, 0, 11, PALETTE.woodDark).setStrokeStyle(1, PALETTE.wood);
      const num = this.add.text(-40, 0, String(i + 1), {
        fontFamily: "ui-monospace, monospace",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#f5ebd7",
      }).setOrigin(0.5);
      const label = this.add.text(8, 0, name, {
        fontFamily: "ui-monospace, monospace",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#b8a88c",
      }).setOrigin(0.5);
      const statusIcon = this.add.text(35, 0, "○", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "13px",
        color: "#b8a88c",
      }).setOrigin(0.5);
      container.add([glow, pill, numCircle, num, label, statusIcon]);

      this.pills.set(name, { container, glow, pill, num, numCircle, label, statusIcon });
    }
    // Connector line (single, behind)
    this.connector = this.add.graphics();
  }

  layoutPills() {
    const w = this.scale.width;
    const padX = 60;
    const usable = w - padX * 2;
    const step = usable / (STAGES.length - 1);
    const y = this.ladderY + this.ladderH / 2 + 4;

    // Draw connector line behind pills
    this.connector.clear();
    this.connector.lineStyle(2, PALETTE.wood, 0.6);
    this.connector.lineBetween(padX, y, w - padX, y);

    STAGES.forEach((name, i) => {
      const p = this.pills.get(name);
      if (!p) return;
      p.container.setPosition(padX + i * step, y);
    });
  }

  render() {
    const statuses = session.stageStatuses();
    let activeIdx = -1;
    let doneCount = 0;
    let activeName = "";
    statuses.forEach((s, i) => {
      const p = this.pills.get(s.name);
      if (!p) return;
      this.applyStatus(p, s.status);
      if (s.status === "active") { activeIdx = i; activeName = s.name; }
      if (s.status === "done") doneCount += 1;
    });

    const total = STAGES.length;
    const currentNum = activeIdx >= 0 ? activeIdx + 1 : doneCount;
    const text = activeName
      ? `${currentNum} / ${total} · ${activeName}`
      : doneCount === total ? `✓ COMPLETE` : `— / ${total}`;
    this.counter.setText(text);
    this.counter.setColor(activeName ? "#f5ebd7" : "#b8a88c");
  }

  applyStatus(p, status) {
    this.tweens.killTweensOf(p.glow);
    if (status === "done") {
      p.pill.setFillStyle(PALETTE.pillDone, 1);
      p.pill.setStrokeStyle(2, PALETTE.green);
      p.label.setColor("#a8d994");
      p.statusIcon.setText("✓").setColor("#a8d994");
      p.glow.setAlpha(0);
    } else if (status === "active") {
      p.pill.setFillStyle(PALETTE.pillActive, 1);
      p.pill.setStrokeStyle(2, PALETTE.gold);
      p.label.setColor("#ffd966");
      p.statusIcon.setText("●").setColor("#ffd966");
      p.glow.setAlpha(0.35);
      this.tweens.add({
        targets: p.glow,
        alpha: { from: 0.5, to: 0.15 },
        yoyo: true,
        repeat: -1,
        duration: 700,
      });
    } else {
      p.pill.setFillStyle(PALETTE.pill, 1);
      p.pill.setStrokeStyle(2, PALETTE.wood);
      p.label.setColor("#b8a88c");
      p.statusIcon.setText("○").setColor("#b8a88c");
      p.glow.setAlpha(0);
    }
  }
}
