// Layouts for the scrolling stage: where every dot goes in each state (no DOM).
// Positions are in stage units (the stage's viewBox); the page moves marks between them.

import { formatNum, pct } from "./format.js";
import { linear } from "./scale.js";

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // the sunflower angle, about 137.5 degrees

/**
 * n points packed in a disc (Vogel's sunflower), evenly spaced at `spacing` apart, around (cx, cy).
 * The radius grows with the square root of n, so equal areas hold equal counts.
 */
export function sunflower(n, cx, cy, spacing) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = spacing * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * The injury death dots: one per death in an average year, by type and age band.
 * Returns [{ type, band }] in a fixed order: falls first, youngest band first.
 */
export function deathUnits(bands, falls, poisoning) {
  const units = [];
  for (const [type, counts] of [["falls", falls], ["poisoning", poisoning]]) {
    counts.forEach((n, i) => {
      for (let k = 0; k < n; k++) units.push({ type, band: bands[i] });
    });
  }
  return units;
}

/** Every unit in one crowd (state "crowd"); the order is shuffled so types mix. */
export function crowdLayout(units, cx, cy, spacing) {
  const pts = sunflower(units.length, cx, cy, spacing);
  // spread the two types through the disc: a fixed interleaving, not random, for stable tests
  const order = interleave(units);
  const out = new Array(units.length);
  order.forEach((u, k) => {
    out[u] = pts[k];
  });
  return out;
}

/** Indices of units, alternating types in proportion, so a crowd has no visible split. */
export function interleave(units) {
  const a = [];
  const b = [];
  units.forEach((u, i) => (u.type === units[0].type ? a : b).push(i));
  const out = [];
  let ia = 0;
  let ib = 0;
  while (ia < a.length || ib < b.length) {
    // take from whichever list is behind its share
    if (ib >= b.length || (ia < a.length && ia / a.length <= ib / b.length)) out.push(a[ia++]);
    else out.push(b[ib++]);
  }
  return out;
}

/** Two crowds, one per type, centred at the given x positions (state "split"). */
export function splitLayout(units, centres, cy, spacing) {
  const out = new Array(units.length);
  for (const [type, cx] of Object.entries(centres)) {
    const idx = units.map((u, i) => (u.type === type ? i : -1)).filter((i) => i >= 0);
    const pts = sunflower(idx.length, cx, cy, spacing);
    idx.forEach((u, k) => {
      out[u] = pts[k];
    });
  }
  return out;
}

/**
 * Stacked columns by age band, one column per type within each band (state "age").
 * box: { x, y, w, h } the plotting area; columns are `wide` dots across; dots `gap` apart.
 * Returns positions, plus the x centre of each band for its label.
 */
export function ageLayout(units, bands, box, wide = 8, gap = 4.2) {
  const slot = box.w / bands.length;
  const out = new Array(units.length);
  const filled = {};
  units.forEach((u, i) => {
    const b = bands.indexOf(u.band);
    const key = `${u.type}|${b}`;
    const k = (filled[key] = (filled[key] ?? -1) + 1);
    const colX = box.x + b * slot + slot / 2 + (u.type === "falls" ? -1 : 1) * (wide * gap) * 0.55;
    const x = colX + ((k % wide) - (wide - 1) / 2) * gap;
    const y = box.y + box.h - Math.floor(k / wide) * gap;
    out[i] = [x, y];
  });
  return { positions: out, bandX: bands.map((_, b) => box.x + b * slot + slot / 2) };
}

/** Council positions on a scatter: x = share in the most deprived fifth, y = rate. */
export function scatterLayout(councils, box, xMax, yMax) {
  const x = linear([0, xMax], [box.x, box.x + box.w]);
  const y = linear([0, yMax], [box.y + box.h, box.y]);
  return councils.map((c) => [x(c.share_q1), y(c.rate)]);
}

/** The colour bin of a rate on the map: thresholds ascending, colours dim to bright. */
export function binColour(value, thresholds, colours) {
  let i = 0;
  while (i < thresholds.length && value >= thresholds[i]) i++;
  return colours[i];
}

/** One sentence placing a council among the 32, for "find your council". */
export function councilSentence(name, councils, scotland) {
  const sorted = [...councils].sort((a, b) => b.rate - a.rate);
  const k = sorted.findIndex((c) => c.council === name);
  if (k < 0) return "";
  const c = sorted[k];
  const where =
    c.vs === "above" ? "above the Scotland rate" : c.vs === "below" ? "below the Scotland rate" : "close to the Scotland rate";
  return (
    `${c.council}: ${formatNum(c.rate, 1)} poisoning deaths per 100,000 people a year, ` +
    `${ordinal(k + 1)} highest of 32 and ${where} of ${formatNum(scotland, 1)}. ` +
    `${pct(c.share_q1, 0)} of its people live in Scotland's most deprived fifth of neighbourhoods.`
  );
}

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A grid index over points [[x, y, ...]] for fast nearest-point lookups. */
export function gridIndex(points, cell = 8) {
  const cells = new Map();
  points.forEach((p, i) => {
    const key = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  });
  return { cells, cell, points };
}

/** The index of the point nearest (x, y) within maxDist, or -1. */
export function nearest(index, x, y, maxDist) {
  const { cells, cell, points } = index;
  const reach = Math.ceil(maxDist / cell);
  const cx = Math.floor(x / cell);
  const cy = Math.floor(y / cell);
  let best = -1;
  let bestD = maxDist * maxDist;
  for (let i = cx - reach; i <= cx + reach; i++) {
    for (let j = cy - reach; j <= cy + reach; j++) {
      for (const k of cells.get(`${i},${j}`) ?? []) {
        const d = (points[k][0] - x) ** 2 + (points[k][1] - y) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = k;
        }
      }
    }
  }
  return best;
}

const FIFTHS = ["most deprived fifth", "second most deprived fifth", "middle fifth", "second least deprived fifth", "least deprived fifth"];

/** The tooltip for a neighbourhood: name, council, rank and fifth, people. */
export function zoneTip(zone, name, councils, total = 6976) {
  const [, , q, rank, people, c] = zone;
  return (
    `${name}, ${councils[c].council}. Ranked ${rank.toLocaleString("en-GB")} of ` +
    `${total.toLocaleString("en-GB")} (1 = most deprived): ${FIFTHS[q - 1]}. ` +
    `${people.toLocaleString("en-GB")} people.`
  );
}
