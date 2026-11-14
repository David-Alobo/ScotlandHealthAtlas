// Tests against the real data file, so the text and charts are checked with the numbers shipped.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dotInterval, dumbbell, groupedBars, lineChart } from "../js/charts.js";
import { daysIn, facts, perDay, shareOf } from "../js/facts.js";
import {
  aeChart,
  ageChart,
  councilChart,
  medicineChart,
  shareColour,
  tables,
} from "../js/scenes.js";
import { COLOURS } from "../js/charts.js";

const story = JSON.parse(readFileSync(new URL("../data/story.json", import.meta.url), "utf8"));

describe("facts", () => {
  const f = facts(story);

  it("fills every fact the page asks for", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const asked = [...html.matchAll(/data-fact="([^"]+)"/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(20);
    for (const name of asked) {
      expect(f[name], name).toBeDefined();
      if (name !== "inArea") expect(f[name], name).toBeTruthy(); // inArea is empty for Scotland
    }
  });

  it("quotes the A&E gap from the data", () => {
    const { quintiles, years } = story.ae;
    const last = years.length - 1;
    expect(f.aeQ1Latest).toBe(Math.round(quintiles[0].rate[last]).toLocaleString("en-GB"));
    expect(Number(f.aeRatioMin)).toBeGreaterThan(1.5);
  });

  it("quotes injury death totals from unrounded values", () => {
    const d = story.injury_ages.deaths;
    expect(f.fallsDeaths).toBe(d.falls_total.toLocaleString("en-GB"));
    const bandSum = d.falls.reduce((a, b) => a + b, 0);
    expect(Math.abs(bandSum - d.falls_total)).toBeLessThanOrEqual(d.falls.length / 2);
  });

  it("counts days in calendar and financial years", () => {
    expect(daysIn("2024")).toBe(366);
    expect(daysIn("2025")).toBe(365);
    expect(daysIn("2023/24")).toBe(366); // includes 29 February 2024
    expect(daysIn("2024/25")).toBe(365);
    expect(daysIn("June 2025 to May 2026")).toBe(365);
    expect(perDay({ value: 732, period: "2024" })).toBe(2);
  });

  it("computes shares by age band", () => {
    expect(shareOf(["a", "b", "c"], [1, 1, 2], ["c"])).toBe(0.5);
    expect(shareOf(["a"], [0], ["a"])).toBe(0);
  });

  it("names the council extremes", () => {
    const rates = story.councils.councils.map((c) => c.rate);
    expect(Number(f.councilHighRate)).toBeCloseTo(Math.max(...rates), 1);
    expect(Number(f.councilLowRate)).toBeCloseTo(Math.min(...rates), 1);
  });
});

describe("charts", () => {
  const count = (svg, re) => (svg.match(re) || []).length;

  it("draws one point per quintile and year, each with a tooltip", () => {
    const svg = lineChart(aeChart(story));
    expect(count(svg, /<circle /g)).toBe(5 * story.ae.years.length);
    expect(count(svg, /data-tip=/g)).toBe(5 * story.ae.years.length);
    expect(svg).toContain("1 most deprived");
    expect(svg).not.toContain("NaN");
  });

  it("draws two bars per age band", () => {
    const svg = groupedBars(ageChart(story));
    expect(count(svg, /class="bar /g)).toBe(2 * story.injury_ages.bands.length);
    expect(svg).not.toContain("NaN");
  });

  it("draws every council, highest first, escaping names", () => {
    const opts = councilChart(story);
    expect(opts.rows).toHaveLength(32);
    expect(opts.rows[0].value).toBeGreaterThanOrEqual(opts.rows[31].value);
    const svg = dotInterval(opts);
    expect(count(svg, /<circle /g)).toBe(32);
    expect(svg).not.toContain("NaN");
  });

  it("draws two dots per medicine group", () => {
    const svg = dumbbell(medicineChart(story));
    expect(count(svg, /data-tip=/g)).toBe(2 * story.medicines.chapters.length);
  });
});

describe("scenes", () => {
  it("bins council deprivation shares into the ramp", () => {
    expect(shareColour(0.45)).toBe(COLOURS.quintile[0]);
    expect(shareColour(0.35)).toBe(COLOURS.quintile[1]);
    expect(shareColour(0.1)).toBe(COLOURS.quintile[3]);
    expect(shareColour(0)).toBe(COLOURS.quintile[4]);
  });

  it("builds a table for every chart", () => {
    const t = tables(story);
    for (const key of ["ae", "ages", "councils", "medicines"]) expect(t[key]).toContain("<table>");
    expect((t.councils.match(/<tr>/g) || []).length).toBe(33);
  });
});

describe("annotations", () => {
  it("draws a labelled bracket when a note is given", () => {
    const opts = aeChart(story);
    const last = story.ae.years.length - 1;
    const svg = lineChart({
      ...opts,
      note: { at: last, from: opts.series[0].values[last], to: opts.series[4].values[last], text: "twice" },
    });
    expect(svg).toContain('class="annotation"');
    expect(svg).toContain(">twice<");
  });
});

describe("chart sizes", () => {
  it("fills a requested height", () => {
    const svg = dumbbell({ ...medicineChart(story), height: 600, values: true });
    expect(svg).toContain('viewBox="0 0 640 600"');
    expect(svg).toContain('class="value-label"');
    expect(lineChart({ ...aeChart(story), height: 560 })).toContain('viewBox="0 0 640 560"');
  });
});

describe("ratio chart", () => {
  it("starts its value axis at 1.0 (no gap)", async () => {
    const { ratioChart } = await import("../js/scenes.js");
    const svg = lineChart(ratioChart(story));
    expect(svg).toContain(">1.0<");
    expect(svg).not.toContain(">0.5<");
    expect(svg).not.toContain("NaN");
  });
});

describe("headline facts", async () => {
  const { aboveBelow, trendFacts } = await import("../js/facts.js");
  const { equalCountBreaks, binColour } = await import("../js/stage.js");

  it("count councils clearly above and below Scotland, with their deprivation", () => {
    const f = aboveBelow(story.councils.councils);
    expect(f.aboveCount).toBe("8");
    expect(f.belowCount).toBe("14");
    expect(Number.parseInt(f.aboveQ1)).toBeGreaterThan(Number.parseInt(f.belowQ1));
  });

  it("describe the rise and fall of poisoning deaths", () => {
    const f = trendFacts(story.death_trend);
    expect(f.poisonFirst).toBe("663");
    expect(f.poisonPeak).toBe("1,373");
    expect(f.poisonPeakYear).toBe("2020");
    expect(f.fallsLast).toBe("1,290");
  });

  it("split the councils into bands of about equal size", () => {
    const rates = story.councils.councils.map((c) => c.rate);
    const breaks = equalCountBreaks(rates, 5);
    expect(breaks).toHaveLength(4);
    const colours = ["a", "b", "c", "d", "e"];
    const counts = {};
    for (const r of rates) counts[binColour(r, breaks, colours)] = (counts[binColour(r, breaks, colours)] ?? 0) + 1;
    for (const c of colours) expect(counts[c]).toBeGreaterThanOrEqual(5);
  });
});
