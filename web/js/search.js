// Finding a neighbourhood by postcode or by name (no DOM). Postcodes live in one small file per
// postcode area (data/postcodes/G.json, EH.json, ...), loaded only when a reader types one.

/** A query as a postcode ({ type: "postcode", key, area }) or a name ({ type: "name", text }). */
export function parseQuery(q) {
  const key = q.replace(/\s+/g, "").toUpperCase();
  const m = /^([A-Z]{1,2})\d[A-Z\d]?\d[A-Z]{2}$/.exec(key);
  if (m) return { type: "postcode", key, area: m[1] };
  return { type: "name", text: q.trim().toLowerCase() };
}

/** Neighbourhoods whose names match: names starting with the text first, then containing it. */
export function searchNames(names, text, limit = 8) {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return [];
  const starts = [];
  const contains = [];
  names.forEach((n, i) => {
    const low = n.toLowerCase();
    if (low.startsWith(t)) starts.push(i);
    else if (low.includes(t)) contains.push(i);
  });
  return [...starts, ...contains].slice(0, limit);
}

/** The zone index for a postcode, given the area's table, or -1 if not found. */
export function lookupPostcode(table, key) {
  return Object.hasOwn(table, key) ? table[key] : -1;
}
