// The area filter: a chosen council, or a pinned neighbourhood (which also chooses its council).
// Health figures exist at three levels only: by deprivation fifth (A&E, all of Scotland), by
// council (injuries, prescribing), and per neighbourhood only for deprivation itself. Every text
// here says which level its number describes. No DOM.

import { escapeXml as esc, formatInt, formatNum, pct } from "./format.js";
import { deathUnits, ordinal } from "./stage.js";

export const MIN_DEATHS = 20; // fewer deaths of a type in the pooled years: too few to show
const FIFTHS = ["most deprived fifth", "second most deprived fifth", "middle fifth", "second least deprived fifth", "least deprived fifth"];
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** The council's record, or null. */
export function councilOf(story, name) {
  return story.councils.councils.find((c) => c.council === name) ?? null;
}

/**
 * Death dots for a council over the pooled years: one dot per death, types with fewer than
 * MIN_DEATHS left out (and listed in `hidden`).
 */
export function councilUnits(story, name) {
  const c = councilOf(story, name);
  const bands = story.injury_ages.bands;
  const falls = sum(c.deaths_falls) >= MIN_DEATHS ? c.deaths_falls : bands.map(() => 0);
  const poisoning = sum(c.deaths_poisoning) >= MIN_DEATHS ? c.deaths_poisoning : bands.map(() => 0);
  const hidden = [];
  if (sum(c.deaths_falls) < MIN_DEATHS) hidden.push("falls");
  if (sum(c.deaths_poisoning) < MIN_DEATHS) hidden.push("poisoning");
  return {
    units: deathUnits(bands, falls, poisoning),
    falls: sum(c.deaths_falls),
    poisoning: sum(c.deaths_poisoning),
    hidden,
  };
}

/** The rank (1 = highest) of a council's value among all councils. */
function rankOf(story, name, key) {
  const sorted = [...story.councils.councils].sort((a, b) => b[key] - a[key]);
  return sorted.findIndex((c) => c.council === name) + 1;
}

/**
 * A short note for each scene about the chosen area. filter: { council, zone } where zone is an
 * index into geo.zones (or null). Returns { [state]: text }; states without a note are absent.
 */
export function localNotes(story, geo, filter) {
  const notes = {};
  if (!filter.council) return notes;
  const name = filter.council;
  const c = councilOf(story, name);
  const z = filter.zone === null || filter.zone === undefined ? null : geo.zones[filter.zone];
  const zname = z ? geo.zone_names[filter.zone] : "";
  const dz = story.deprived_zones.by_council[name];
  const cs = story.councils;

  notes.deprived =
    (z ? `${zname} is in Scotland's ${FIFTHS[z[2] - 1]}. ` : "") +
    `In ${name}, ${formatInt(dz.q1)} of ${formatInt(dz.zones)} neighbourhoods (${pct(dz.q1 / dz.zones, 0)}) are in the most deprived fifth.`;
  notes.glasgow = notes.deprived;

  const aeLevel = "A&E figures in this data are by deprivation fifth for all of Scotland, not by council.";
  if (z) {
    const last = story.ae.years.length - 1;
    const rate = story.ae.quintiles[z[2] - 1].rate[last];
    notes.ae =
      `${zname} is in the ${FIFTHS[z[2] - 1]}: across Scotland, people in that fifth went to A&E ` +
      `${formatNum(rate)} times per 1,000 in ${story.ae.years[last]}. ${aeLevel}`;
  } else {
    notes.ae = aeLevel;
  }
  notes["ae-ratio"] = aeLevel;

  const u = councilUnits(story, name);
  const years = cs.pooled_years;
  const death = `${name}, ${cs.period}: ${formatInt(u.falls)} deaths after a fall and ${formatInt(u.poisoning)} from poisoning, ${years} years together (1 dot = 1 death).`;
  const few = u.hidden.length
    ? ` Too few ${u.hidden.join(" and ")} deaths to show reliably (under ${MIN_DEATHS}).`
    : "";
  notes.crowd = death + few;
  notes.split = death + few;
  notes.age = death + few;

  const poison =
    `${name}: ${formatNum(c.rate, 1)} poisoning deaths per 100,000 a year ` +
    `(95% interval ${formatNum(c.lower, 1)} to ${formatNum(c.upper, 1)}), ` +
    `${ordinal(rankOf(story, name, "rate"))} highest of 32; Scotland ${formatNum(cs.scotland, 1)}.`;
  notes["poison-map"] = poison;
  notes.scatter = `${poison} ${pct(c.share_q1, 0)} of its people live in the most deprived fifth.`;
  notes.find = notes.scatter;

  notes.medicines =
    `${name}: ${formatNum(c.items_per_person, 1)} items dispensed per person a year, ` +
    `${ordinal(rankOf(story, name, "items_per_person"))} highest of 32 (counted where dispensed, not age-adjusted).`;

  notes.end =
    `${name}: poisoning deaths ${formatNum(c.rate, 1)} per 100,000 a year (${ordinal(rankOf(story, name, "rate"))} of 32); ` +
    `emergency admissions after a fall ${formatNum(c.falls_rate)} per 100,000 a year (${ordinal(c.falls_rank)} of 32; Scotland ${formatNum(cs.scotland_falls)}).`;
  return notes;
}

/** The "your area" panel: the neighbourhood (if pinned), its fifth, its council. HTML. */
export function areaPanel(story, geo, filter, detail = null) {
  if (!filter.council) return "";
  const name = filter.council;
  const c = councilOf(story, name);
  const cs = story.councils;
  const dz = story.deprived_zones.by_council[name];
  let html = "";

  if (filter.zone !== null && filter.zone !== undefined) {
    const i = filter.zone;
    const [, , q, rank, people] = geo.zones[i];
    const last = story.ae.years.length - 1;
    html +=
      `<section><h4>This neighbourhood</h4><p class="ap-name">${esc(geo.zone_names[i])}</p>` +
      `<p>Ranked <b>${formatInt(rank)}</b> of ${formatInt(geo.zones.length)} (1 = most deprived) · ${formatInt(people)} people</p>`;
    if (detail) {
      const worst = detail.domains
        .map((d, k) => [d, detail.ranks[i][k]])
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .map(([d, r]) => `${d.toLowerCase()} (${formatInt(r)})`);
      html += `<p>Most deprived on ${worst.join(" and ")}.</p>`;
    }
    html +=
      `</section><section><h4>Its deprivation fifth, all of Scotland</h4>` +
      `<p>The ${FIFTHS[q - 1]}: <b>${formatNum(story.ae.quintiles[q - 1].rate[last])}</b> A&amp;E visits per 1,000 people in ${story.ae.years[last]}, ` +
      `against ${formatNum(story.ae.quintiles[4].rate[last])} in the least deprived fifth (same age and sex).</p></section>`;
  }

  html +=
    `<section><h4>${esc(name)}</h4>` +
    `<dl class="ap-grid">` +
    `<dt>Poisoning deaths</dt><dd><b>${formatNum(c.rate, 1)}</b> per 100,000 a year · ${ordinal(rankOf(story, name, "rate"))} of 32 · Scotland ${formatNum(cs.scotland, 1)}</dd>` +
    `<dt>Admissions after a fall</dt><dd><b>${formatNum(c.falls_rate)}</b> per 100,000 a year · ${ordinal(c.falls_rank)} of 32 · Scotland ${formatNum(cs.scotland_falls)}</dd>` +
    `<dt>Most deprived fifth</dt><dd><b>${pct(c.share_q1, 0)}</b> of people · ${formatInt(dz.q1)} of ${formatInt(dz.zones)} neighbourhoods</dd>` +
    `<dt>Prescriptions</dt><dd><b>${formatNum(c.items_per_person, 1)}</b> items per person a year (where dispensed)</dd>` +
    `</dl></section>` +
    `<p class="ap-note">Health figures are not published for single neighbourhoods: each number says whether it describes the neighbourhood, its deprivation fifth or its council. Rates are standardised for age and sex (${cs.period}; falls ${cs.falls_period}).</p>`;
  return html;
}
