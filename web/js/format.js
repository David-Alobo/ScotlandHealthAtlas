// Number and text formatting for the story (British English conventions).

const GB = "en-GB";

/** A whole number with thousands separators: 1652428 -> "1,652,428". */
export function formatInt(n) {
  return Math.round(n).toLocaleString(GB);
}

/** A large number in words: 113247207 -> "113 million", 1652428 -> "1.65 million". */
export function formatLarge(n) {
  if (Math.abs(n) >= 1e6) {
    const m = n / 1e6;
    const digits = m >= 100 ? 0 : m >= 10 ? 1 : 2;
    return `${Number(m.toFixed(digits)).toLocaleString(GB)} million`;
  }
  return formatInt(n);
}

/** A fraction as a percentage: 0.2124 -> "21.2%". */
export function pct(x, digits = 1) {
  return `${(100 * x).toFixed(digits)}%`;
}

/** A number to a fixed number of decimals, with separators: 380.16 -> "380". */
export function formatNum(n, digits = 0) {
  return n.toLocaleString(GB, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Escape text for use inside SVG or HTML markup. */
export function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
