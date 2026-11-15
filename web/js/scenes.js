// Turn story.json into the chart options and the tables behind each chart (no DOM).

import { COLOURS } from "./charts.js";
import { escapeXml as esc, formatNum, pct } from "./format.js";

const QUINTILE_NAMES = ["1 most deprived", "2", "3", "4", "5 least deprived"];

/** Colour for a council by the share of its people in the most deprived fifth. */
export function shareColour(share) {
  const bins = [0.4, 0.3, 0.2, 0.1]; // 40%+ darkest
  const i = bins.findIndex((b) => share >= b);
  return COLOURS.quintile[i === -1 ? 4 : i];
}

export const SHARE_LEGEND = [
  ["40% or more", COLOURS.quintile[0]],
  ["30-40%", COLOURS.quintile[1]],
  ["20-30%", COLOURS.quintile[2]],
  ["10-20%", COLOURS.quintile[3]],
  ["under 10%", COLOURS.quintile[4]],
];

export function aeChart(story, palette = COLOURS.quintile) {
  const { years, quintiles } = story.ae;
  return {
    years,
    series: quintiles.map((q, i) => ({
      label: QUINTILE_NAMES[i],
      values: q.rate,
      colour: palette[i],
    })),
    yLabel: "A&E attendances per 1,000 people",
    label: "A&E attendances per 1,000 people by deprivation quintile, standardised for age and sex",
  };
}

export function ageChart(story, dataset = "deaths", colours = COLOURS) {
  const a = story.injury_ages;
  const d = a[dataset];
  return {
    bands: a.bands,
    groups: [
      { key: "falls", label: "Falls", values: d.falls, colour: colours.falls },
      { key: "poisoning", label: "Poisoning", values: d.poisoning, colour: colours.poisoning },
    ],
    yLabel: dataset === "deaths" ? "Deaths a year" : "Admissions a year",
    xLabel: "Age (years)",
    label: `Unintentional injury ${dataset} a year by age, falls and poisoning, ${d.period}`,
  };
}

export function councilChart(story) {
  const c = story.councils;
  const rows = [...c.councils]
    .sort((a, b) => b.rate - a.rate)
    .map((r) => ({
      label: r.council,
      value: r.rate,
      lower: r.lower,
      upper: r.upper,
      colour: shareColour(r.share_q1),
      tip:
        `${r.council}: ${formatNum(r.rate, 1)} per 100,000 a year ` +
        `(95% interval ${formatNum(r.lower, 1)} to ${formatNum(r.upper, 1)}); ` +
        `${pct(r.share_q1, 0)} of people in the most deprived fifth`,
    }));
  return {
    rows,
    reference: { value: c.scotland, label: `Scotland ${formatNum(c.scotland, 1)}` },
    xLabel: "Poisoning deaths per 100,000 people a year (age-sex standardised)",
    label: `Poisoning death rates by council area, ${c.period}`,
  };
}

export function medicineChart(story) {
  return {
    rows: story.medicines.chapters.map((c) => ({ label: c.chapter, a: c.q1, b: c.q5 })),
    aLabel: "Most deprived fifth",
    bLabel: "Least deprived fifth",
    aColour: COLOURS.quintile[0],
    bColour: COLOURS.quintile[4],
    xLabel: "Share of items dispensed",
    label: "Share of items by medicine group, most and least deprived fifth of areas",
  };
}

/** Emergency departments: the share seen within 4 hours, against the 95% standard. */
export function waitsChart(story, colours = { line: COLOURS.quintile[2], target: COLOURS.ink3 }) {
  const w = story.access.waits;
  return {
    years: w.years,
    series: [
      { label: "Seen within 4 hours", values: w.within_4h.map((v) => 100 * v), colour: colours.line },
      { label: "95% standard", values: w.years.map(() => 100 * w.target), colour: colours.target },
    ],
    yLabel: "Share of attendances (%)",
    fmt: (v) => `${formatNum(v, 1)}%`,
    yMin: 50, // the axis starts at 50%: every year is above 60%
    label: "Share of emergency department attendances seen within 4 hours, Scotland, by year",
  };
}

/** Emergency departments: the share waiting more than 8 and more than 12 hours. */
export function longWaitsChart(story, colours = { over8: COLOURS.quintile[3], over12: COLOURS.quintile[0] }) {
  const w = story.access.waits;
  return {
    years: w.years,
    series: [
      { label: "Over 8 hours", values: w.over_8h.map((v) => 100 * v), colour: colours.over8 },
      { label: "Over 12 hours", values: w.over_12h.map((v) => 100 * v), colour: colours.over12 },
    ],
    yLabel: "Share of attendances (%)",
    fmt: (v) => `${formatNum(v, 1)}%`,
    label: "Share of emergency department attendances waiting more than 8 and more than 12 hours, Scotland, by year",
  };
}

/** GPs per 10,000 registered patients by the deprivation fifth of the practice's area. */
export function gpChart(story, colours = { head: COLOURS.quintile[3], wte: COLOURS.quintile[0] }) {
  const q = story.access.gp.quintiles;
  return {
    bands: ["Most deprived", "2", "3", "4", "Least deprived"],
    groups: [
      { key: "head", label: "GPs", values: q.map((r) => r.headcount_per_10000), colour: colours.head },
      { key: "wte", label: "Full-time equivalent", values: q.map((r) => r.wte_per_10000), colour: colours.wte },
    ],
    yLabel: "Per 10,000 patients",
    xLabel: "Deprivation fifth of the practice's area",
    fmt: (v) => formatNum(v, 1),
    unit: " per 10,000 patients",
    label: `GPs and their full-time equivalent per 10,000 registered patients, by deprivation fifth of the practice's area, ${story.access.gp.date}`,
  };
}

/** An HTML table: head is a list of column names, rows a list of lists of cell text. */
export function table(head, rows) {
  const th = head.map((h) => `<th scope="col">${esc(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

export function tables(story) {
  const ae = story.ae;
  const a = story.injury_ages;
  return {
    ae: table(
      ["Year", ...QUINTILE_NAMES],
      ae.years.map((y, i) => [y, ...ae.quintiles.map((q) => formatNum(q.rate[i]))]),
    ),
    ages: table(
      ["Age", "Falls deaths", "Poisoning deaths", "Falls admissions", "Poisoning admissions"],
      a.bands.map((b, i) => [
        b,
        formatNum(a.deaths.falls[i]),
        formatNum(a.deaths.poisoning[i]),
        formatNum(a.admissions.falls[i]),
        formatNum(a.admissions.poisoning[i]),
      ]),
    ),
    councils: table(
      ["Council", "Rate per 100,000", "95% interval", "In most deprived fifth"],
      [...story.councils.councils]
        .sort((x, y) => y.rate - x.rate)
        .map((c) => [
          c.council,
          formatNum(c.rate, 1),
          `${formatNum(c.lower, 1)} to ${formatNum(c.upper, 1)}`,
          pct(c.share_q1, 0),
        ]),
    ),
    medicines: table(
      ["Medicine group", "Most deprived fifth", "Least deprived fifth"],
      story.medicines.chapters.map((c) => [c.chapter, pct(c.q1), pct(c.q5)]),
    ),
    waits: table(
      ["Year", "Attendances", "Seen within 4 hours", "Over 8 hours", "Over 12 hours"],
      story.access.waits.years.map((y, i) => [
        y,
        formatNum(story.access.waits.attendances[i]),
        pct(story.access.waits.within_4h[i]),
        pct(story.access.waits.over_8h[i]),
        pct(story.access.waits.over_12h[i]),
      ]),
    ),
    gp: table(
      ["Practice area", "Registered patients", "GPs per 10,000", "Full-time equivalent per 10,000"],
      story.access.gp.quintiles.map((r) => [
        QUINTILE_NAMES[r.quintile - 1],
        formatNum(r.patients),
        formatNum(r.headcount_per_10000, 1),
        formatNum(r.wte_per_10000, 1),
      ]),
    ),
  };
}

/** "Is it closing?": the A&E ratio as recorded, and if the extra unknowns came from the most deprived. */
export function ratioChart(story, colours = { recorded: COLOURS.quintile[2], alternative: COLOURS.falls }) {
  const r = story.ae.ratio;
  return {
    years: r.map((x) => x.year),
    series: [
      { label: "As recorded", values: r.map((x) => x.published), colour: colours.recorded },
      { label: "Upper estimate", values: r.map((x) => x.excess_to_q1), colour: colours.alternative },
    ],
    yLabel: "Ratio, most to least deprived fifth",
    fmt: (v) => formatNum(v, 1),
    yMin: 1, // 1.0 = no gap: both fifths go equally often
    label: "Ratio of A&E attendance rates, most to least deprived fifth, as recorded and if the growth in unknown deprivation came from the most deprived",
  };
}
