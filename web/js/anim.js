// Interpolation helpers for the canvas animation (no DOM).

/** Ease in and out (cubic): 0 -> 0, 0.5 -> 0.5, 1 -> 1, slow at both ends. */
export function ease(t) {
  const c = Math.min(1, Math.max(0, t));
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

export const lerp = (a, b, t) => a + (b - a) * t;

/** "#rrggbb" -> [r, g, b]. */
export function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix two [r, g, b] colours. */
export function lerpRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Progress of item i at time `now`, for a transition started at `start` lasting `duration` ms,
 *  each item delayed by up to `spread` ms (a fixed, scattered delay, so motion ripples). */
export function progress(now, start, duration, i = 0, spread = 0) {
  const delay = spread ? (i * 37) % spread : 0;
  return ease((now - start - delay) / duration);
}

/** A map transform {tx, ty, s} between two others. */
export function lerpTransform(a, b, t) {
  return { tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t), s: lerp(a.s, b.s, t) };
}

/** How a viewBox of size (W, H) sits in a box of (cw, ch) pixels with "xMidYMid meet". */
export function fit(W, H, cw, ch) {
  const k = Math.min(cw / W, ch / H);
  return { k, ox: (cw - W * k) / 2, oy: (ch - H * k) / 2 };
}
