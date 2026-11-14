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
  };
}
