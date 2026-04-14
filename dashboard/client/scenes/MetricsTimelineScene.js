/**
 * MetricsTimelineScene — bottom strip.
 * Left 70%: gantt-style timeline of agent activity + issue/file markers.
 * Right 30%: metric cards (elapsed, events, files, issues).
 */

import { session } from "../state/session.js";

const PALETTE = {
  bg:        0x2a2420,
  panel:     0x3c342c,
  panelAlt:  0x453a30,
  wood:      0x8b6f47,
  woodDark:  0x5c4a30,
  woodLight: 0xc9a876,
  cream:     0xf5ebd7,
  creamMuted: 0xb8a88c,
  gold:      0xffd966,
  green:     0xa8d994,
  warn:      0xf2b24a,
  crit:      0xff8566,
};

const MARGIN = 16;
const SPLIT = 0.7; // 70% timeline, 30% metrics

export class MetricsTimelineScene extends Phaser.Scene {
  constructor() {
    super({ key: "MetricsTimelineScene", active: true });
    this.barElements = new Map(); // agentId → {row, bars:[]}
    this.markerElements = [];
  }

  create() {
    this.stripY = this.registry.get("stripY") ?? (this.scale.height - 200);
    this.stripH = this.registry.get("stripH") ?? 200;

    // Background strip
    this.bg = this.add.rectangle(0, this.stripY, this.scale.width, this.stripH, PALETTE.bg).setOrigin(0, 0);
    this.topLine = this.add.rectangle(0, this.stripY, this.scale.width, 2, PALETTE.wood).setOrigin(0, 0);

    this.timelineGraphics = this.add.graphics();
    this.markerGraphics = this.add.graphics();

    // Timeline panel label
    this.tlLabel = this.add.text(MARGIN, this.stripY + 10, "TIMELINE", {
      fontFamily: "ui-monospace, monospace",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#b8a88c",
      letterSpacing: 3,
    });

    // Metrics panel container
    this.metricsCards = [];
    this.buildMetricsCards();

    // Redraw on state change and periodically for elapsed time
    this.unsub = session.subscribe(() => this.render());
    this.tickTimer = this.time.addEvent({ delay: 500, loop: true, callback: () => this.render() });

    this.scale.on("resize", () => {
      this.bg.width = this.scale.width;
      this.topLine.width = this.scale.width;
      this.render();
    });
  }

  buildMetricsCards() {
    const cardDefs = [
      { key: "elapsed", label: "ELAPSED",  icon: "⏱", color: "#c9a876" },
      { key: "events",  label: "EVENTS",   icon: "📊", color: "#c9a876" },
      { key: "files",   label: "FILES",    icon: "📄", color: "#a8d994" },
      { key: "crit",    label: "CRITICAL", icon: "🚨", color: "#ff8566" },
      { key: "high",    label: "HIGH",     icon: "⚠",  color: "#f2b24a" },
      { key: "med",     label: "MEDIUM",   icon: "·",  color: "#f2b24a" },
    ];
    for (const def of cardDefs) {
      const bg = this.add.rectangle(0, 0, 100, 50, PALETTE.panel).setOrigin(0, 0);
      bg.setStrokeStyle(1, PALETTE.wood);
      const iconLabel = this.add.text(0, 0, `${def.icon} ${def.label}`, {
        fontFamily: "ui-monospace, monospace",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#b8a88c",
        letterSpacing: 1,
      });
      const value = this.add.text(0, 0, "—", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color: def.color,
      });
      this.metricsCards.push({ def, bg, iconLabel, value });
    }
  }

  render() {
    const w = this.scale.width;
    const h = this.stripH;
    const y = this.stripY;

    const tlW = Math.floor(w * SPLIT) - MARGIN * 1.5;
    const tlX = MARGIN;
    const tlTopY = y + 30;
    const tlBotY = y + h - 16;
    const tlH = tlBotY - tlTopY;

    const metricsX = Math.floor(w * SPLIT) + MARGIN / 2;
    const metricsW = w - metricsX - MARGIN;

    this.renderTimeline(tlX, tlTopY, tlW, tlH);
    this.renderMetrics(metricsX, y + 30, metricsW, h - 48);
  }

  renderTimeline(x, y, w, h) {
    const s = session.state;
    const startT = s.sessionStartAt ?? Date.now();
    const endT = s.sessionEndAt ?? Date.now();
    const spanT = Math.max(endT - startT, 10 * 1000); // min 10s span so empty scene isn't too weird

    this.timelineGraphics.clear();
    this.markerGraphics.clear();

    // Frame
    this.timelineGraphics.fillStyle(PALETTE.panel, 0.7);
    this.timelineGraphics.fillRoundedRect(x, y, w, h, 6);
    this.timelineGraphics.lineStyle(1, PALETTE.woodDark, 0.8);
    this.timelineGraphics.strokeRoundedRect(x, y, w, h, 6);

    // Gather agents that have any activity (segments or currently active)
    const rows = [];
    const agentsWithData = new Set([
      ...s.agentSegments.keys(),
      ...s.agentActive.keys(),
    ]);
    for (const agent of agentsWithData) rows.push(agent);
    rows.sort();

    // Clean up stale bar elements for agents no longer in view
    for (const [agentId, el] of this.barElements) {
      if (!agentsWithData.has(agentId)) {
        if (el.label) el.label.destroy();
        this.barElements.delete(agentId);
      }
    }

    if (rows.length === 0) {
      const empty = this.ensureText("tl-empty", x + w / 2, y + h / 2, "no activity yet", {
        fontSize: "11px", color: "#5c4a30",
      });
      empty.setOrigin(0.5);
      return;
    } else {
      this.removeText("tl-empty");
    }

    const rowH = Math.max(12, Math.min(22, (h - 8) / rows.length));
    const labelW = 90;
    const barAreaX = x + labelW;
    const barAreaW = w - labelW - 8;

    for (let i = 0; i < rows.length; i++) {
      const agent = rows[i];
      const rowY = y + 4 + i * rowH + rowH / 2;

      // Label
      const lbl = this.ensureText(`tl-lbl-${agent}`, x + 8, rowY, agent, {
        fontSize: "10px", color: "#b8a88c",
      });
      lbl.setOrigin(0, 0.5);

      // Bars for completed segments
      const segs = s.agentSegments.get(agent) ?? [];
      for (const seg of segs) {
        const bx1 = barAreaX + ((seg.start - startT) / spanT) * barAreaW;
        const bx2 = barAreaX + ((seg.end - startT) / spanT) * barAreaW;
        const bw = Math.max(2, bx2 - bx1);
        this.timelineGraphics.fillStyle(PALETTE.green, 0.75);
        this.timelineGraphics.fillRect(bx1, rowY - 5, bw, 10);
      }
      // In-progress bar
      const activeStart = s.agentActive.get(agent);
      if (activeStart) {
        const bx1 = barAreaX + ((activeStart - startT) / spanT) * barAreaW;
        const bx2 = barAreaX + ((endT - startT) / spanT) * barAreaW;
        const bw = Math.max(2, bx2 - bx1);
        this.timelineGraphics.fillStyle(PALETTE.gold, 0.85);
        this.timelineGraphics.fillRect(bx1, rowY - 5, bw, 10);
      }
    }

    // Issue markers (vertical ticks across all rows)
    for (const m of s.issueMarkers) {
      const mx = barAreaX + ((m.at - startT) / spanT) * barAreaW;
      const color = m.severity === "critical" ? PALETTE.crit : PALETTE.warn;
      this.markerGraphics.lineStyle(2, color, 0.9);
      this.markerGraphics.lineBetween(mx, y + 4, mx, y + h - 4);
    }

    // File markers (small dots on top row of bar area)
    for (const m of s.fileMarkers) {
      const mx = barAreaX + ((m.at - startT) / spanT) * barAreaW;
      this.markerGraphics.fillStyle(PALETTE.green, 1);
      this.markerGraphics.fillCircle(mx, y + h - 4, 2);
    }

    // Time axis caption
    const elapsedSec = Math.floor(session.elapsedMs() / 1000);
    const tSpanText = this.ensureText("tl-span", x + w - 8, y + h + 4, `${formatDuration(elapsedSec)} span`, {
      fontSize: "9px", color: "#5c4a30",
    });
    tSpanText.setOrigin(1, 0);
  }

  renderMetrics(x, y, w, h) {
    const s = session.state;
    const cardW = Math.floor((w - 10) / 3);
    const cardH = Math.floor((h - 10) / 2);

    const values = {
      elapsed: formatDuration(Math.floor(session.elapsedMs() / 1000)),
      events: String(s.eventCount),
      files: String(s.fileCount),
      crit: String(s.issues.critical),
      high: String(s.issues.high),
      med: String(s.issues.med),
    };

    this.metricsCards.forEach((card, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = x + col * (cardW + 5);
      const cy = y + row * (cardH + 5);
      card.bg.setPosition(cx, cy);
      card.bg.width = cardW;
      card.bg.height = cardH;
      card.iconLabel.setPosition(cx + 8, cy + 8);
      card.value.setPosition(cx + 8, cy + cardH - 28);
      card.value.setText(values[card.def.key]);
    });
  }

  ensureText(key, x, y, text, style) {
    if (!this.textMap) this.textMap = new Map();
    let t = this.textMap.get(key);
    if (!t) {
      t = this.add.text(x, y, text, {
        fontFamily: "ui-monospace, monospace",
        ...style,
      });
      this.textMap.set(key, t);
    } else {
      t.setText(text);
      t.setPosition(x, y);
      if (style.color) t.setColor(style.color);
    }
    return t;
  }
  removeText(key) {
    const t = this.textMap?.get(key);
    if (t) { t.destroy(); this.textMap.delete(key); }
  }
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
