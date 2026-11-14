// The area filter: a chosen council, or a pinned neighbourhood (which also chooses its council).
// Health figures exist at three levels only: by deprivation fifth (A&E, all of Scotland), by
// council (injuries, prescribing), and per neighbourhood only for deprivation itself. Every text
// here says which level its number describes. No DOM.

import { escapeXml as esc, formatInt, formatNum, pct } from "./format.js";
import { readableRate } from "./facts.js";
import { deathUnits, locatorSvg, ordinal } from "./stage.js";

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
  // the split and age cards show the area's own figures, so their notes only warn
  if (few) {
    notes.split = few.trim();
    notes.age = few.trim();
  }

  const poison =
    `${name}: ${formatNum(c.rate, 1)} poisoning deaths per 100,000 a year ` +
    `(95% interval ${formatNum(c.lower, 1)} to ${formatNum(c.upper, 1)}), ` +
    `${ordinal(rankOf(story, name, "rate"))} highest of 32; Scotland ${formatNum(cs.scotland, 1)}.`;
  notes["poison-map"] = poison;
  notes.scatter = `${poison} ${pct(c.share_q1, 0)} of its people live in the most deprived fifth.`;
  // the find card shows its own sentence for the council, so no note there

  notes.trend = "The trend is for all of Scotland: one council's deaths each year are too few for a reliable line.";
  notes["scatter-falls"] =
    `${name}: ${formatNum(c.falls_rate)} emergency admissions after a fall per 100,000 a year, ` +
    `${ordinal(c.falls_rank)} highest of 32; Scotland ${formatNum(cs.scotland_falls)}.`;
  notes.medicines =
    `${name}: ${formatNum(c.items_per_person, 1)} items dispensed per person a year, ` +
    `${ordinal(rankOf(story, name, "items_per_person"))} highest of 32 (counted where dispensed, not age-adjusted).`;

  notes.end =
    `${name}: poisoning deaths ${formatNum(c.rate, 1)} per 100,000 a year (${ordinal(rankOf(story, name, "rate"))} of 32); ` +
    `emergency admissions after a fall ${formatNum(c.falls_rate)} per 100,000 a year (${ordinal(c.falls_rank)} of 32; Scotland ${formatNum(cs.scotland_falls)}).`;
  return notes;
}

/** The panel's header: locator map, the neighbourhood's (or council's) name, and its council. */
export function areaHead(story, geo, filter) {
  if (!filter.council) return "";
  const ci = geo.councils.findIndex((c) => c.council === filter.council);
  const council = geo.councils[ci];
  const pinned = filter.zone !== null && filter.zone !== undefined;
  const [x, y] = pinned ? geo.zones[filter.zone] : [council.cx, council.cy];
  return (
    `<div class="ap-head">${locatorSvg(council, x, y)}<div>` +
    `<p class="ap-name">${esc(pinned ? geo.zone_names[filter.zone] : filter.council)}</p>` +
    `<p class="ap-sub">${pinned ? esc(filter.council) : "Council area"}</p></div></div>`
  );
}

/** A labelled comparison: the area's value as a bar, Scotland as a tick, on a 0..max scale. */
function compare(label, value, text, scotland, max, rank) {
  const at = (v) => Math.min(100, (100 * v) / max).toFixed(1);
  return (
    `<div class="ap-stat"><div class="ap-stat-top"><span>${label}</span><span class="ap-rank">${rank}</span></div>` +
    `<p class="ap-big">${text}</p>` +
    `<div class="ap-bar"><i style="width:${at(value)}%"></i><b style="left:${at(scotland)}%" title="Scotland"></b></div>` +
    `</div>`
  );
}

/**
 * The panel's sections, one per tab: the neighbourhood (if pinned), its deprivation fifth across
 * Scotland, and its council against Scotland. HTML.
 */
export function areaPanel(story, geo, filter, detail = null) {
  if (!filter.council) return "";
  const name = filter.council;
  const c = councilOf(story, name);
  const cs = story.councils;
  const dz = story.deprived_zones.by_council[name];
  const all = cs.councils;
  const max = (key) => Math.max(...all.map((x) => x[key]));
  let html = "";

  if (filter.zone !== null && filter.zone !== undefined) {
    const i = filter.zone;
    const total = geo.zones.length;
    const [, , q, rank, people] = geo.zones[i];
    const at = (r) => ((100 * (r - 1)) / (total - 1)).toFixed(1);
    const bars = detail
      ? detail.domains
          .map(
            (d, k) =>
              `<div class="zc-row"><span class="zc-lbl">${esc(d)}</span>` +
              `<span class="zc-track"><i style="left:${at(detail.ranks[i][k])}%"></i></span>` +
              `<span class="zc-val">${formatInt(detail.ranks[i][k])}</span></div>`,
          )
          .join("")
      : `<p class="zc-wait">Loading the seven areas of deprivation…</p>`;
    html +=
      `<section data-tab="Neighbourhood">` +
      `<p class="ap-big">${ordinal(rank)} <span>most deprived of ${formatInt(total)} · ${formatInt(people)} people</span></p>` +
      `<div class="zc-bars">${bars}</div>` +
      `<p class="ap-foot">Rank in Scotland on each part of the index: left = more deprived.</p>` +
      `</section>`;

    const last = story.ae.years.length - 1;
    const rates = story.ae.quintiles.map((x) => x.rate[last]);
    const top = Math.max(...rates);
    const names = ["Most deprived", "2nd", "Middle", "4th", "Least deprived"];
    html +=
      `<section data-tab="Its fifth">` +
      `<p class="ap-lead">${esc(geo.zone_names[i])} is in the <b>${FIFTHS[q - 1]}</b>. Across Scotland, A&amp;E visits per 1,000 people in ${story.ae.years[last]}:</p>` +
      `<div class="ap-fifths">` +
      rates
        .map(
          (r, k) =>
            `<div class="ap-fifth${k === q - 1 ? " on" : ""}"><span>${names[k]}</span>` +
            `<span class="ap-fbar"><i style="width:${((100 * r) / top).toFixed(1)}%"></i></span>` +
            `<span class="ap-fval">${formatNum(r)}</span></div>`,
        )
        .join("") +
      `</div><p class="ap-foot">Same age and sex. A&amp;E data are by fifth for all of Scotland, not by council.</p>` +
      `</section>`;
  }

  html +=
    `<section data-tab="${esc(name)}">` +
    compare("Poisoning deaths", c.rate, `${formatNum(c.rate, 1)} <span>per 100,000 a year</span>`, cs.scotland, max("rate"),
      `${ordinal(rankOf(story, name, "rate"))} of 32`) +
    compare("Admissions after a fall", c.falls_rate, `${formatNum(c.falls_rate)} <span>per 100,000 a year</span>`,
      cs.scotland_falls, max("falls_rate"), `${ordinal(c.falls_rank)} of 32`) +
    compare("People in the most deprived fifth", c.share_q1, `${pct(c.share_q1, 0)} <span>${formatInt(dz.q1)} of ${formatInt(dz.zones)} neighbourhoods</span>`,
      0.2, max("share_q1"), `${ordinal(rankOf(story, name, "share_q1"))} of 32`) +
    `<p class="ap-foot">Bar: ${esc(name)} · tick: Scotland. Rates standardised for age and sex, ${cs.period} (falls ${cs.falls_period}).</p>` +
    `</section>`;
  return html;
}

/**
 * The card figures that change with the pinned area: { factName: text }. Only figures the data
 * has for a council are given; sentences true only of Scotland are marked data-national in the
 * page and hidden while an area is pinned. Types with too few deaths say so instead of a share.
 */
export function areaFacts(story, filter) {
  if (!filter.council) return {};
  const name = filter.council;
  const c = councilOf(story, name);
  const bands = story.injury_ages.bands;
  const dz = story.deprived_zones.by_council[name];
  const share = (counts, wanted) => {
    const total = sum(counts);
    if (total < MIN_DEATHS) return "too few to show";
    return pct(sum(counts.filter((_, i) => wanted.includes(bands[i]))) / total, 0);
  };
  // the opening's figures: the council's own (A&E: its health board's hospitals), each as a
  // readable average with its unit in the label
  const h = story.hero;
  const local = story.hero_by_council[name];
  const tile = (key, period) => readableRate({ value: local[key], period });
  const ae = tile("ae_attendances", h.ae_attendances.period);
  const adm = tile("injury_admissions", h.injury_admissions.period);
  const dth = tile("injury_deaths", h.injury_deaths.period);
  const rx = tile("prescription_items", h.prescription_items.period);
  return {
    dayHeading: `On average in ${name}`,
    dayAe: formatInt(ae.value),
    dayAeLabel: `visits to A&E ${ae.unit} at ${local.health_board} hospitals`,
    dayAdmissions: formatInt(adm.value),
    dayAdmissionsLabel: `emergency admissions after an accident, ${adm.unit}`,
    dayDeaths: formatInt(dth.value),
    dayDeathsLabel: `deaths from an accident, ${dth.unit}`,
    dayItems: formatInt(rx.value),
    dayItemsLabel: `prescription items dispensed ${rx.unit}`,
    zonesQ1: formatInt(dz.q1),
    inArea: ` in ${name}`,
    deathsUnit: `in ${name} over ${story.councils.pooled_years} years`,
    fallsDeaths: formatInt(sum(c.deaths_falls)),
    poisoningDeaths: formatInt(sum(c.deaths_poisoning)),
    falls75Share: share(c.deaths_falls, ["75+"]),
    poisoning2564Share: share(c.deaths_poisoning, ["25-44", "45-64"]),
  };
}
