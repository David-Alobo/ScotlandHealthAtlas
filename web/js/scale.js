// Scales, ticks and label layout for the SVG charts (no DOM).

/** A linear map from a domain [d0, d1] to a range [r0, r1]. */
export function linear([d0, d1], [r0, r1]) {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

/** Round, readable tick values covering [min, max], about `count` of them. */
export function niceTicks(min, max, count = 5) {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= max + 1e-9 * step; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** The smallest round number at or above `max`, to top an axis: 429 -> 500, 38.8 -> 40. */
export function niceMax(max, count = 5) {
  const ticks = niceTicks(0, max, count);
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : max;
  return Math.ceil(max / step - 1e-9) * step;
}

/**
 * Vertical positions for end labels so that none sit closer than `gap` (screen units, y down).
 * Labels keep their order; each is pushed down from the one above when they would touch.
 * Returns the positions in the input order.
 */
export function spreadLabels(ys, gap) {
  const order = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]);
  const placed = [];
  for (const [y] of order) {
    const prev = placed.length ? placed[placed.length - 1] : -Infinity;
    placed.push(Math.max(y, prev + gap));
  }
  const out = new Array(ys.length);
  order.forEach(([, i], k) => {
    out[i] = placed[k];
  });
  return out;
}
