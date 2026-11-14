// The facts quoted in the story text, derived from story.json (no DOM), so every number in the
// prose comes from the data file and is tested.

import { formatInt, formatLarge, formatNum, pct } from "./format.js";

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

/** Share of `values` falling in the bands whose labels are in `wanted`. */
export function shareOf(bands, values, wanted) {
  const total = sum(values);
  return total ? sum(values.filter((_, i) => wanted.includes(bands[i]))) / total : 0;
}

/** Every fact the text needs, as display strings keyed by name. */
export function facts(story) {
  const { hero, ae, injury_ages: ages, councils, medicines } = story;
  const last = ae.years.length - 1;
  const q1 = ae.quintiles[0].rate;
  const q5 = ae.quintiles[4].rate;
  const ratios = ae.years.map((_, i) => q1[i] / q5[i]);
  const latestSens = ae.ratio[ae.ratio.length - 1];

  const d = ages.deaths;
  const sorted = [...councils.councils].sort((a, b) => a.rate - b.rate);
  const cns = medicines.chapters.find((c) => c.chapter === "Central nervous system");

  return {
    heroAe: formatLarge(hero.ae_attendances.value),
    heroAePeriod: hero.ae_attendances.period,
    heroAdmissions: formatInt(hero.injury_admissions.value),
    heroAdmissionsPeriod: hero.injury_admissions.period,
    heroDeaths: formatInt(hero.injury_deaths.value),
    heroDeathsPeriod: hero.injury_deaths.period,
    heroItems: formatLarge(hero.prescription_items.value),
    heroItemsPeriod: hero.prescription_items.period,

    aeLatestYear: String(ae.years[last]),
    aeFirstYear: String(ae.years[0]),
    aeQ1Latest: formatNum(q1[last]),
    aeQ5Latest: formatNum(q5[last]),
    aeRatioMin: formatNum(Math.min(...ratios), 1),
    aeRatioMax: formatNum(Math.max(...ratios), 1),
    aeRatioExcess: formatNum(latestSens.excess_to_q1, 2),
    aeRatioPublished: formatNum(latestSens.published, 2),
    aeRatioFloor: formatNum(latestSens.all_to_q5, 1),

    deathsPeriod: d.period,
    fallsDeaths: formatInt(d.falls_total),
    poisoningDeaths: formatInt(d.poisoning_total),
    falls75Share: pct(shareOf(ages.bands, d.falls, ["75+"]), 0),
    poisoning2564Share: pct(shareOf(ages.bands, d.poisoning, ["25-44", "45-64"]), 0),
    fallsWomenShare: pct(1 - d.falls_male_share, 0),
    poisoningMenShare: pct(d.poisoning_male_share, 0),

    councilPeriod: councils.period,
    councilLowName: sorted[0].council,
    councilLowRate: formatNum(sorted[0].rate, 1),
    councilHighName: sorted[sorted.length - 1].council,
    councilHighRate: formatNum(sorted[sorted.length - 1].rate, 1),
    scotlandPoisoning: formatNum(councils.scotland, 1),
    rhoPoisoning: formatNum(councils.rho_poisoning_deaths, 2),
    rhoFalls: formatNum(councils.rho_falls_admissions, 2),

    cnsQ1: cns ? pct(cns.q1) : "",
    cnsQ5: cns ? pct(cns.q5) : "",
    medicinesPeriod: medicines.period,
  };
}
