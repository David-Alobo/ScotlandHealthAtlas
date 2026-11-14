// SVG chart builders: data in, markup out (no DOM), so they can be unit tested.
// No gridlines; lines and dots are labelled directly; every mark carries its tooltip in data-tip.

import { escapeXml as esc, formatNum } from "./format.js";
import { linear, niceMax, niceTicks, spreadLabels } from "./scale.js";

export const COLOURS = {
  ink: "#0b0b0b",
  ink2: "#52514e",
  ink3: "#7a7974",
  rule: "#c9c8c3",
  falls: "#2a78d6",
  poisoning: "#eb6834",
  // SIMD quintiles, one blue ramp: darkest = most deprived (validated as an ordinal ramp)
  quintile: ["#0d366b", "#184f95", "#256abf", "#3987e5", "#86b6ef"],
};

const W = 640;
const svgOpen = (h, label) =>
  `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}" class="chart">`;
const text = (x, y, s, attrs = "") => `<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;

/** Left axis: tick labels and short ticks, no gridlines. */
function yAxis(ticks, y, left, fmt) {
  const top = Math.min(...ticks.map(y));
  const bottom = Math.max(...ticks.map(y));
  return `<line x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" class="axis-line"/>` + ticks
    .map(
      (t) =>
        `<line x1="${left - 4}" x2="${left}" y1="${y(t)}" y2="${y(t)}" class="tick"/>` +
        text(left - 8, y(t), fmt(t), 'class="axis-label" text-anchor="end" dominant-baseline="middle"'),
    )
    .join("");
}

/**
 * A bracket between two heights at one x position, with a label beside it, so the chart states
 * its point in place. Coordinates are screen units.
 */
export function bracket(x, yTop, yBottom, label) {
  const w = 6;
  const mid = (yTop + yBottom) / 2;
  return (
    `<path d="M${x - w},${yTop} H${x} V${yBottom} H${x - w}" class="annotation"/>` +
    text(x + 8, mid, label, 'class="annotation-label" dominant-baseline="middle"')
  );
}

/**
 * Lines over years, labelled at their ends.
 * opts: { years, series: [{ label, values, colour }], yLabel, fmt, label, height (default 340),
 *         yMin: where the value axis starts (default 0),
 *         note: optional { at, from, to, text }, a bracket between two values at year index at }
 */
export function lineChart({
  years, series, yLabel, fmt = (v) => formatNum(v), label, note, height = 340, yMin = 0,
}) {
  const H = height;
  const m = { t: 18, r: note ? 200 : 150, b: 40, l: 58 }; // a note sits beyond the end labels
  const top = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const x = linear([0, years.length - 1], [m.l + 10, W - m.r]);
  const y = linear([yMin, top], [H - m.b, m.t]);
  let out = svgOpen(H, label);
  out += yAxis(niceTicks(yMin, top), y, m.l, fmt);
  out += `<line x1="${m.l}" x2="${W - m.r + 10}" y1="${y(yMin)}" y2="${y(yMin)}" class="axis-line"/>`;
  out += years
    .map(
      (yr, i) =>
        `<line x1="${x(i)}" x2="${x(i)}" y1="${y(yMin)}" y2="${y(yMin) + 4}" class="tick"/>` +
        text(x(i), H - m.b + 18, yr, 'class="axis-label" text-anchor="middle"'),
    )
    .join("");
  out += text(14, (H - m.b + m.t) / 2, yLabel,
    `class="axis-title" text-anchor="middle" transform="rotate(-90 14 ${(H - m.b + m.t) / 2})"`);
  for (const s of series) {
    const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    out += `<path d="${d}" fill="none" stroke="${s.colour}" stroke-width="2.2" class="series"/>`;
    out += s.values
      .map(
        (v, i) =>
          `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.colour}" class="ring" stroke-width="2" ` +
          `data-tip="${esc(`${s.label}, ${years[i]}: ${fmt(v)}`)}" tabindex="0"/>`,
      )
      .join("");
  }
  if (note) out += bracket(x(note.at) + 128, y(note.from), y(note.to), note.text);
  const ends = spreadLabels(series.map((s) => y(s.values[s.values.length - 1])), 15);
  out += series
    .map((s, i) =>
      text(x(years.length - 1) + 10, ends[i], s.label, `class="end-label" dominant-baseline="middle"`),
    )
    .join("");
  return `${out}</svg>`;
}

/**
 * Bars by band, one bar per group side by side; a legend at the top left.
 * opts: { bands, groups: [{ key, label, values, colour }], yLabel, xLabel, label }
 */
export function groupedBars({ bands, groups, yLabel, xLabel, label }) {
  const H = 320;
  const m = { t: 34, r: 16, b: 52, l: 58 };
  const top = niceMax(Math.max(...groups.flatMap((g) => g.values)));
  const y = linear([0, top], [H - m.b, m.t]);
  const slot = (W - m.l - m.r) / bands.length;
  const bw = (slot * 0.78) / groups.length;
  let out = svgOpen(H, label);
  out += yAxis(niceTicks(0, top), y, m.l, (v) => formatNum(v));
  out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" class="axis-line"/>`;
  bands.forEach((b, i) => {
    const x0 = m.l + i * slot + slot * 0.11;
    out += text(m.l + (i + 0.5) * slot, H - m.b + 18, b, 'class="axis-label" text-anchor="middle"');
    groups.forEach((g, j) => {
      const v = g.values[i];
      const h = y(0) - y(v);
      out +=
        `<rect x="${(x0 + j * bw + 1).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 2).toFixed(1)}" ` +
        `height="${Math.max(h, 0).toFixed(1)}" rx="2" fill="${g.colour}" class="bar g-${g.key}" ` +
        `data-tip="${esc(`${g.label}, ${b}: ${formatNum(v)} a year`)}" tabindex="0"/>`;
    });
  });
  out += text(m.l + (W - m.l - m.r) / 2, H - 8, xLabel, 'class="axis-title" text-anchor="middle"');
  out += text(14, (H - m.b + m.t) / 2, yLabel,
    `class="axis-title" text-anchor="middle" transform="rotate(-90 14 ${(H - m.b + m.t) / 2})"`);
  out += groups
    .map(
      (g, j) =>
        `<g class="legend g-${g.key}" transform="translate(${m.l + 10 + j * 120},10)">` +
        `<rect width="12" height="12" rx="2" fill="${g.colour}"/>` +
        text(18, 10, g.label, 'class="legend-label"') +
        "</g>",
    )
    .join("");
  return `${out}</svg>`;
}

/**
 * One row per item: a dot with its interval, against a reference line, sorted as given.
 * opts: { rows: [{ label, value, lower, upper, colour, tip }], reference: { value, label },
 *         xLabel, label }
 */
export function dotInterval({ rows, reference, xLabel, label }) {
  const rowH = 17;
  const m = { t: 26, r: 24, b: 46, l: 150 };
  const H = m.t + rows.length * rowH + m.b;
  const top = niceMax(Math.max(...rows.map((r) => r.upper)));
  const x = linear([0, top], [m.l, W - m.r]);
  const yOf = (i) => m.t + (i + 0.5) * rowH;
  let out = svgOpen(H, label);
  out += niceTicks(0, top)
    .map((t) => text(x(t), H - m.b + 18, formatNum(t), 'class="axis-label" text-anchor="middle"'))
    .join("");
  out += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b + 4}" y2="${H - m.b + 4}" class="axis-line"/>`;
  out += `<line x1="${m.l}" x2="${m.l}" y1="${m.t - 4}" y2="${H - m.b + 4}" class="axis-line"/>`;
  out += `<line x1="${x(reference.value)}" x2="${x(reference.value)}" y1="${m.t - 6}" y2="${H - m.b + 4}" class="reference"/>`;
  out += text(x(reference.value), m.t - 10, reference.label, 'class="ref-label" text-anchor="middle"');
  rows.forEach((r, i) => {
    const cy = yOf(i);
    out += text(m.l - 10, cy, r.label, 'class="row-label" text-anchor="end" dominant-baseline="middle"');
    out += `<line x1="${x(r.lower)}" x2="${x(r.upper)}" y1="${cy}" y2="${cy}" stroke="${r.colour}" stroke-width="2" stroke-linecap="round"/>`;
    out += `<circle cx="${x(r.value)}" cy="${cy}" r="4.5" fill="${r.colour}" class="ring" stroke-width="1.5" data-tip="${esc(r.tip)}" tabindex="0"/>`;
  });
  out += text(m.l + (W - m.l - m.r) / 2, H - 8, xLabel, 'class="axis-title" text-anchor="middle"');
  return `${out}</svg>`;
}

/**
 * Two values per row joined by a line (most against least deprived).
 * opts: { rows: [{ label, a, b }], aLabel, bLabel, aColour, bColour, xLabel, label,
 *         height: optional total height (rows share it), values: label each dot with its value }
 */
export function dumbbell({ rows, aLabel, bLabel, aColour, bColour, xLabel, label, height, values }) {
  const m = { t: 40, r: values ? 64 : 24, b: 54, l: 190 }; // room for value labels
  const rowH = height ? (height - m.t - m.b) / rows.length : 34;
  const H = height ?? m.t + rows.length * rowH + m.b;
  const top = niceMax(Math.max(...rows.flatMap((r) => [r.a, r.b])) * 100) / 100;
  const x = linear([0, top], [m.l, W - m.r]);
  const pc = (v) => `${(100 * v).toFixed(1)}%`;
  let out = svgOpen(H, label);
  out += niceTicks(0, top * 100)
    .map((t) => text(x(t / 100), H - m.b + 18, `${t}%`, 'class="axis-label" text-anchor="middle"'))
    .join("");
  out += `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b + 4}" y2="${H - m.b + 4}" class="axis-line"/>`;
  out += `<line x1="${m.l}" x2="${m.l}" y1="${m.t - 4}" y2="${H - m.b + 4}" class="axis-line"/>`;
  rows.forEach((r, i) => {
    const cy = m.t + (i + 0.5) * rowH;
    out += text(m.l - 10, cy, r.label, 'class="row-label" text-anchor="end" dominant-baseline="middle"');
    out += `<line x1="${x(r.a)}" x2="${x(r.b)}" y1="${cy}" y2="${cy}" stroke="${COLOURS.rule}" stroke-width="3"/>`;
    out += `<circle cx="${x(r.a)}" cy="${cy}" r="6" fill="${aColour}" class="ring" stroke-width="2" data-tip="${esc(`${r.label}, ${aLabel}: ${pc(r.a)}`)}" tabindex="0"/>`;
    out += `<circle cx="${x(r.b)}" cy="${cy}" r="6" fill="${bColour}" class="ring" stroke-width="2" data-tip="${esc(`${r.label}, ${bLabel}: ${pc(r.b)}`)}" tabindex="0"/>`;
    if (values) {
      // values outside the pair: the smaller to the left, the larger to the right
      const [lo, hi] = r.a <= r.b ? [r.a, r.b] : [r.b, r.a];
      out += text(x(lo) - 11, cy, pc(lo), 'class="value-label" text-anchor="end" dominant-baseline="middle"');
      out += text(x(hi) + 11, cy, pc(hi), 'class="value-label" dominant-baseline="middle"');
    }
  });
  out +=
    `<g transform="translate(${m.l},12)"><circle cx="6" cy="6" r="6" fill="${aColour}"/>` +
    text(18, 10, aLabel, 'class="legend-label"') +
    `<circle cx="196" cy="6" r="6" fill="${bColour}"/>` +
    text(208, 10, bLabel, 'class="legend-label"') +
    "</g>";
  out += text(m.l + (W - m.l - m.r) / 2, H - 8, xLabel, 'class="axis-title" text-anchor="middle"');
  return `${out}</svg>`;
}
