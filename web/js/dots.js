// The canvas layer of the stage: neighbourhood dots and death dots, animated in one loop.
// Coordinates are stage units (the SVG viewBox); the canvas maps them like the SVG does, so both
// layers line up. The map transform is shared with the SVG council layer through onMap.

import { fit, hexToRgb, lerpRgb, lerpTransform, progress } from "./anim.js";

const DURATION = 1500; // ms for every move
const SPREAD = 400; // ms of scattered delay across dots

export class DotCanvas {
  /**
   * canvas: the element; W, H: the stage viewBox; zones: [[x, y, quintile]] in map units;
   * units: [{ type }]; onMap(transform): called every frame with the current map transform.
   */
  constructor(canvas, W, H, zones, units, onMap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = W;
    this.H = H;
    this.zones = zones;
    this.units = units;
    this.onMap = onMap;
    const n = units.length;
    this.pos = { from: new Float32Array(2 * n), to: new Float32Array(2 * n) };
    this.map = { from: { tx: 0, ty: 0, s: 1 }, to: { tx: 0, ty: 0, s: 1 } };
    // per-quintile colours and per-type colours, each with an alpha
    this.zoneCol = { from: zoneColours([]), to: zoneColours([]) };
    this.unitCol = { from: {}, to: {} };
    this.alpha = { zones: [0, 0], units: [0, 0] };
    this.zoneR = [1.15, 1.15];
    this.unitR = 2;
    this.start = 0;
    this.running = false;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    const f = fit(this.W, this.H, r.width, r.height);
    this.view = { k: f.k * dpr, ox: f.ox * dpr, oy: f.oy * dpr };
    this.draw(performance.now());
  }

  /** Move to a new target: { map, zoneColours, zoneAlpha, zoneR, positions, unitColours, unitAlpha }. */
  go(target, instant = false) {
    const now = performance.now();
    const t = this.current(now);
    this.map.from = t.map;
    this.zoneCol.from = t.zoneCol;
    this.unitCol.from = t.unitCol;
    this.alpha.zones[0] = t.zoneAlpha;
    this.alpha.units[0] = t.unitAlpha;
    this.zoneR[0] = t.zoneR;
    this.pos.from.set(this.currentPositions(now));
    if (target.map) this.map.to = target.map;
    if (target.zoneColours) this.zoneCol.to = target.zoneColours;
    if (target.unitColours) this.unitCol.to = target.unitColours;
    if (target.zoneAlpha !== undefined) this.alpha.zones[1] = target.zoneAlpha;
    if (target.unitAlpha !== undefined) this.alpha.units[1] = target.unitAlpha;
    if (target.zoneR !== undefined) this.zoneR[1] = target.zoneR;
    if (target.unitR !== undefined) this.unitR = target.unitR;
    if (target.positions) {
      target.positions.forEach(([x, y], i) => {
        this.pos.to[2 * i] = x;
        this.pos.to[2 * i + 1] = y;
      });
    }
    this.start = instant ? now - DURATION - SPREAD : now;
    if (instant) this.pos.from.set(this.pos.to);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame((ts) => this.frame(ts));
    }
  }

  /** The interpolated state at time now (everything except unit positions). */
  current(now) {
    const t = progress(now, this.start, DURATION);
    const mix = (a, b) => {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const fa = a[k] ?? b[k];
        const fb = b[k] ?? a[k];
        out[k] = { rgb: lerpRgb(fa.rgb, fb.rgb, t), a: fa.a + (fb.a - fa.a) * t };
      }
      return out;
    };
    return {
      map: lerpTransform(this.map.from, this.map.to, t),
      zoneCol: mix(this.zoneCol.from, this.zoneCol.to),
      unitCol: mix(this.unitCol.from, this.unitCol.to),
      zoneAlpha: this.alpha.zones[0] + (this.alpha.zones[1] - this.alpha.zones[0]) * t,
      unitAlpha: this.alpha.units[0] + (this.alpha.units[1] - this.alpha.units[0]) * t,
      zoneR: this.zoneR[0] + (this.zoneR[1] - this.zoneR[0]) * t,
      done: now - this.start > DURATION + SPREAD,
    };
  }

  currentPositions(now) {
    const n = this.units.length;
    const out = new Float32Array(2 * n);
    for (let i = 0; i < n; i++) {
      const t = progress(now, this.start, DURATION, i, SPREAD);
      out[2 * i] = this.pos.from[2 * i] + (this.pos.to[2 * i] - this.pos.from[2 * i]) * t;
      out[2 * i + 1] = this.pos.from[2 * i + 1] + (this.pos.to[2 * i + 1] - this.pos.from[2 * i + 1]) * t;
    }
    return out;
  }

  frame(ts) {
    const done = this.draw(ts);
    if (done) this.running = false;
    else requestAnimationFrame((t) => this.frame(t));
  }

  draw(now) {
    const s = this.current(now);
    const { ctx, view } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.onMap?.(s.map);

    // neighbourhood dots, in map units under the map transform; quintile 1 drawn last (on top)
    if (s.zoneAlpha > 0.01) {
      ctx.setTransform(view.k * s.map.s, 0, 0, view.k * s.map.s, view.ox + view.k * s.map.tx, view.oy + view.k * s.map.ty);
      const r = s.zoneR / s.map.s ** 0.65; // dots shrink a little when zoomed in, so they stay apart
      ctx.globalCompositeOperation = "lighter"; // overlapping light adds up: cities glow
      for (const q of [5, 4, 3, 2, 1]) {
        const c = s.zoneCol[q];
        if (!c || c.a <= 0.01) continue;
        ctx.fillStyle = `rgba(${c.rgb.map(Math.round).join(",")},${(c.a * s.zoneAlpha).toFixed(3)})`;
        ctx.beginPath();
        for (const z of this.zones) {
          if (z[2] !== q) continue;
          ctx.moveTo(z[0] + r, z[1]);
          ctx.arc(z[0], z[1], r, 0, 2 * Math.PI);
        }
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // death dots, in stage units
    if (s.unitAlpha > 0.01) {
      ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
      const p = this.currentPositions(now);
      for (const type of Object.keys(s.unitCol)) {
        const c = s.unitCol[type];
        ctx.fillStyle = `rgba(${c.rgb.map(Math.round).join(",")},${(c.a * s.unitAlpha).toFixed(3)})`;
        ctx.beginPath();
        this.units.forEach((u, i) => {
          if (u.type !== type) return;
          ctx.moveTo(p[2 * i] + this.unitR, p[2 * i + 1]);
          ctx.arc(p[2 * i], p[2 * i + 1], this.unitR, 0, 2 * Math.PI);
        });
        ctx.fill();
      }
    }
    return s.done;
  }
}

/** Colours by quintile: { 1: { rgb, a }, ... }; hexes[i] for quintile i + 1, alpha 1. */
export function zoneColours(hexes, alphas = []) {
  const out = {};
  hexes.forEach((h, i) => {
    out[i + 1] = { rgb: hexToRgb(h), a: alphas[i] ?? 1 };
  });
  return out;
}

/** Colours by unit type: { falls: { rgb, a }, ... }. */
export function typeColours(map) {
  return Object.fromEntries(Object.entries(map).map(([k, h]) => [k, { rgb: hexToRgb(h), a: 1 }]));
}
