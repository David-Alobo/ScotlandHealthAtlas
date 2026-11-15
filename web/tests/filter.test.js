import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIN_DEATHS, areaPanel, councilUnits, localNotes } from "../js/filter.js";

const story = JSON.parse(readFileSync(new URL("../data/story.json", import.meta.url), "utf8"));
const geo = JSON.parse(readFileSync(new URL("../data/geo.json", import.meta.url), "utf8"));
const detail = JSON.parse(readFileSync(new URL("../data/domains.json", import.meta.url), "utf8"));
const ferguslie = geo.zone_names.indexOf("Paisley Ferguslie - 06");

describe("council units", () => {
  it("has one dot per death over the pooled years", () => {
    const u = councilUnits(story, "Glasgow City");
    const c = story.councils.councils.find((x) => x.council === "Glasgow City");
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    expect(u.units).toHaveLength(sum(c.deaths_falls) + sum(c.deaths_poisoning));
    expect(u.hidden).toEqual([]);
  });

  it("leaves out types with too few deaths to show", () => {
    const u = councilUnits(story, "Orkney Islands");
    expect(u.poisoning).toBeLessThan(MIN_DEATHS);
    expect(u.hidden).toContain("poisoning");
    expect(u.units.every((x) => x.type !== "poisoning")).toBe(true);
  });
});

describe("notes", () => {
  it("are empty for Scotland", () => {
    expect(localNotes(story, geo, { council: null, zone: null })).toEqual({});
  });

  it("say which level each number describes", () => {
    const n = localNotes(story, geo, { council: "Renfrewshire", zone: ferguslie });
    expect(n.ae).toMatch(/^Paisley Ferguslie - 06 is in the most deprived fifth: across Scotland/);
    expect(n.ae).toContain("not by council");
    expect(n["poison-map"]).toMatch(/^Renfrewshire: \d+\.\d poisoning deaths per 100,000/);
    expect(n.crowd).toContain("1 dot = 1 death");
    expect(n.age).toBeUndefined(); // the card itself shows the figures
    expect(n.waits).toContain("all of Scotland");
    expect(n.gp).toMatch(/^Paisley Ferguslie - 06 is in the most deprived fifth: practices in neighbourhoods of that fifth have 7\.7 GPs \(5\.5 full-time\)/);
  });

  it("flag small numbers", () => {
    const n = localNotes(story, geo, { council: "Orkney Islands", zone: null });
    expect(n.age).toContain("Too few poisoning deaths to show reliably");
  });
});

describe("panel", async () => {
  const { areaHead } = await import("../js/filter.js");

  it("has a header with the neighbourhood and its council", () => {
    const head = areaHead(story, geo, { council: "Renfrewshire", zone: ferguslie });
    expect(head).toContain("Paisley Ferguslie - 06");
    expect(head).toContain("Renfrewshire");
    expect(head).toContain('class="zc-map"');
  });

  it("has three sections: the neighbourhood, its fifth, its council", () => {
    const html = areaPanel(story, geo, { council: "Renfrewshire", zone: ferguslie }, detail);
    expect((html.match(/<section data-tab=/g) || []).length).toBe(3);
    expect(html).toContain("4th <span>most deprived of 6,976");
    expect((html.match(/class="zc-row"/g) || []).length).toBe(7);
    expect((html.match(/class="ap-fifth( on)?"/g) || []).length).toBe(5);
    expect(html).toContain('class="ap-fifth on"><span>Most deprived'); // its fifth highlighted
    expect((html.match(/class="ap-stat"/g) || []).length).toBe(3);
  });

  it("shows the council alone when no neighbourhood is pinned", () => {
    const html = areaPanel(story, geo, { council: "Highland", zone: null });
    expect((html.match(/<section data-tab=/g) || []).length).toBe(1);
    expect(areaHead(story, geo, { council: "Highland", zone: null })).toContain("Council area");
    expect(areaPanel(story, geo, { council: null, zone: null })).toBe("");
  });

  it("puts Scotland's tick inside every bar", () => {
    const html = areaPanel(story, geo, { council: "Orkney Islands", zone: null });
    for (const m of html.matchAll(/left:([\d.]+)%/g)) expect(Number(m[1])).toBeLessThanOrEqual(100);
  });
});

describe("area facts", async () => {
  const { areaFacts } = await import("../js/filter.js");

  it("change only council-level figures, and only when an area is pinned", () => {
    expect(areaFacts(story, { council: null, zone: null })).toEqual({});
    const f = areaFacts(story, { council: "Glasgow City", zone: null });
    expect(f.zonesQ1).toBe("339");
    expect(f.poisoningDeaths).toBe("1,214");
    expect(f.poisoning2564Share).toMatch(/^\d+%$/);
    expect(f).not.toHaveProperty("fallsWomenShare"); // no sex split by council
    expect(f).not.toHaveProperty("aeQ1Latest"); // A&E is by fifth for Scotland
  });

  it("withhold shares built on too few deaths", () => {
    expect(areaFacts(story, { council: "Orkney Islands", zone: null }).poisoning2564Share).toBe("too few to show");
  });
});

describe("opening figures for an area", async () => {
  const { areaFacts } = await import("../js/filter.js");
  const { readableRate } = await import("../js/facts.js");

  it("pick a readable unit", () => {
    expect(readableRate({ value: 3650, period: "2025" })).toEqual({ value: 10, unit: "a day" });
    expect(readableRate({ value: 104, period: "2025" })).toEqual({ value: 2, unit: "a week" });
    expect(readableRate({ value: 11, period: "2024" })).toEqual({ value: 11, unit: "a year" });
  });

  it("use the council's figures and name the health board for A&E", () => {
    const f = areaFacts(story, { council: "Renfrewshire", zone: null });
    expect(f.dayHeading).toBe("On average in Renfrewshire");
    expect(f.dayAeLabel).toBe("visits to A&E a day at NHS Greater Glasgow and Clyde hospitals");
    const orkney = areaFacts(story, { council: "Orkney Islands", zone: null });
    expect(orkney.dayDeathsLabel).toBe("deaths from an accident, a year");
  });
});
