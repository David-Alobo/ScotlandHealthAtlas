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
    expect(n.age).toContain("1 dot = 1 death");
  });

  it("flag small numbers", () => {
    const n = localNotes(story, geo, { council: "Orkney Islands", zone: null });
    expect(n.age).toContain("Too few poisoning deaths to show reliably");
  });
});

describe("panel", () => {
  it("shows the neighbourhood, its fifth and its council", () => {
    const html = areaPanel(story, geo, { council: "Renfrewshire", zone: ferguslie }, detail);
    expect(html).toContain("Paisley Ferguslie - 06");
    expect(html).toContain("Its deprivation fifth, all of Scotland");
    expect(html).toContain("<h4>Renfrewshire</h4>");
    expect(html).toMatch(/Most deprived on (income|health) \(4\) and (income|health) \(4\)/);
  });

  it("shows the council alone when no neighbourhood is pinned", () => {
    const html = areaPanel(story, geo, { council: "Highland", zone: null });
    expect(html).not.toContain("This neighbourhood");
    expect(html).toContain("<h4>Highland</h4>");
    expect(areaPanel(story, geo, { council: null, zone: null })).toBe("");
  });
});
