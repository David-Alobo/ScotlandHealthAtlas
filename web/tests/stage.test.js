import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ageLayout,
  binColour,
  councilSentence,
  crowdLayout,
  deathUnits,
  interleave,
  ordinal,
  scatterLayout,
  splitLayout,
  sunflower,
} from "../js/stage.js";

const story = JSON.parse(readFileSync(new URL("../data/story.json", import.meta.url), "utf8"));
const geo = JSON.parse(readFileSync(new URL("../data/geo.json", import.meta.url), "utf8"));

describe("sunflower", () => {
  it("places n points within the expected radius, none on top of another", () => {
    const pts = sunflower(500, 0, 0, 3);
    expect(pts).toHaveLength(500);
    const rMax = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    expect(rMax).toBeLessThanOrEqual(3 * Math.sqrt(500) + 1e-9);
    const close = pts.slice(0, 60).some(([x, y], i) =>
      pts.slice(i + 1, 60).some(([a, b]) => Math.hypot(x - a, y - b) < 1.5),
    );
    expect(close).toBe(false);
  });
});

describe("death units", () => {
  const a = story.injury_ages;
  const d = a.deaths;
  const units = deathUnits(a.bands, d.falls, d.poisoning);

  it("has one unit per death in the bands", () => {
    const sum = (xs) => xs.reduce((s, v) => s + v, 0);
    expect(units).toHaveLength(sum(d.falls) + sum(d.poisoning));
    expect(units.filter((u) => u.type === "poisoning" && u.band === "25-44")).toHaveLength(d.poisoning[4]);
  });

  it("interleaves types in proportion", () => {
    const order = interleave(units);
    expect(new Set(order).size).toBe(units.length);
    const firstHundred = order.slice(0, 100).filter((i) => units[i].type === "falls").length;
    expect(firstHundred).toBeGreaterThan(35);
    expect(firstHundred).toBeLessThan(65);
  });

  it("gives every unit a position in each layout", () => {
    for (const pos of [
      crowdLayout(units, 500, 350, 6),
      splitLayout(units, { falls: 300, poisoning: 700 }, 350, 6),
      ageLayout(units, a.bands, { x: 100, y: 100, w: 800, h: 500 }).positions,
    ]) {
      expect(pos).toHaveLength(units.length);
      expect(pos.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))).toBe(true);
    }
  });

  it("splits the crowds to their own sides", () => {
    const pos = splitLayout(units, { falls: 300, poisoning: 700 }, 350, 6);
    const meanX = (t) => {
      const xs = pos.filter((_, i) => units[i].type === t).map((p) => p[0]);
      return xs.reduce((s, v) => s + v, 0) / xs.length;
    };
    expect(meanX("falls")).toBeCloseTo(300, -1);
    expect(meanX("poisoning")).toBeCloseTo(700, -1);
  });

  it("stacks age columns upwards from the baseline", () => {
    const box = { x: 100, y: 100, w: 800, h: 500 };
    const { positions, bandX } = ageLayout(units, a.bands, box);
    expect(bandX).toHaveLength(a.bands.length);
    expect(Math.max(...positions.map((p) => p[1]))).toBeLessThanOrEqual(box.y + box.h);
  });
});

describe("councils", () => {
  const cs = story.councils.councils;

  it("map every council to the map and the scatter", () => {
    const names = new Set(geo.councils.map((c) => c.council));
    for (const c of cs) expect(names.has(c.council), c.council).toBe(true);
    const pos = scatterLayout(cs, { x: 0, y: 0, w: 100, h: 100 }, 0.5, 40);
    const glasgow = pos[cs.findIndex((c) => c.council === "Glasgow City")];
    const orkney = pos[cs.findIndex((c) => c.council === "Orkney Islands")];
    expect(glasgow[0]).toBeGreaterThan(orkney[0]); // more deprived: further right
    expect(glasgow[1]).toBeLessThan(orkney[1]); // higher rate: higher up
  });

  it("bins rates into colours", () => {
    const t = [10, 20, 30];
    const c = ["a", "b", "c", "d"];
    expect(binColour(5, t, c)).toBe("a");
    expect(binColour(10, t, c)).toBe("b");
    expect(binColour(38.8, t, c)).toBe("d");
  });

  it("writes a sentence for any council", () => {
    const s = councilSentence("Glasgow City", cs, story.councils.scotland);
    expect(s).toMatch(/^Glasgow City: 38\.8 .* the highest of 32 and above/);
    expect(councilSentence("Inverclyde", cs, story.councils.scotland)).toContain("2nd highest of 32");
    expect(councilSentence("Nowhere", cs, 22)).toBe("");
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 32].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "32nd",
    ]);
  });
});

describe("geo", () => {
  it("has a dot for every data zone, a fifth in each quintile", () => {
    expect(geo.zones).toHaveLength(6976);
    const q1 = geo.zones.filter((z) => z[2] === 1).length;
    expect(q1).toBe(story.deprived_zones.total_q1);
  });
});

describe("hover", () => {
  it("finds the nearest point within reach, or none", async () => {
    const { gridIndex, nearest } = await import("../js/stage.js");
    const pts = [[0, 0], [10, 0], [10, 10], [55, 55]];
    const idx = gridIndex(pts, 8);
    expect(nearest(idx, 9, 1, 5)).toBe(1);
    expect(nearest(idx, 54, 57, 5)).toBe(3);
    expect(nearest(idx, 30, 30, 5)).toBe(-1);
  });

  it("matches a brute-force search on the real map", async () => {
    const { gridIndex, nearest } = await import("../js/stage.js");
    const idx = gridIndex(geo.zones, 8);
    for (const [x, y] of [[300, 600], [420, 520], [150, 300]]) {
      let best = -1;
      let bd = 36;
      geo.zones.forEach((z, i) => {
        const d = (z[0] - x) ** 2 + (z[1] - y) ** 2;
        if (d <= bd) { bd = d; best = i; }
      });
      expect(nearest(idx, x, y, 6)).toBe(best);
    }
  });

  it("describes a neighbourhood", async () => {
    const { zoneTip } = await import("../js/stage.js");
    const i = geo.zone_names.indexOf("Culter - 01");
    expect(zoneTip(geo.zones[i], geo.zone_names[i], geo.councils)).toBe(
      "Culter - 01, Aberdeen City. Ranked 4,691 of 6,976 (1 = most deprived): second least deprived fifth. 894 people.",
    );
  });
});

describe("neighbourhood card", () => {
  const detail = JSON.parse(readFileSync(new URL("../data/domains.json", import.meta.url), "utf8"));

  it("shows the seven domains, most deprived at the left", async () => {
    const { zoneCard } = await import("../js/stage.js");
    const i = geo.zone_names.indexOf("Paisley Ferguslie - 06");
    const html = zoneCard(geo.zones[i], geo.zone_names[i], geo.councils, detail, i);
    expect(html).toContain("Paisley Ferguslie - 06");
    expect(html).toContain("Renfrewshire");
    expect((html.match(/class="zc-row"/g) || []).length).toBe(7);
    expect(html).toContain('style="left:0.0%"'); // income rank 4 of 6,976: far left
    expect(html).toMatch(/Access to services<\/span><span class="zc-track"><i style="left:80\.6%/);
  });

  it("works before the domain file has loaded, and escapes names", async () => {
    const { zoneCard } = await import("../js/stage.js");
    const html = zoneCard(geo.zones[0], "A & <B>", geo.councils, null, 0);
    expect(html).toContain("A &amp; &lt;B&gt;");
    expect(html).toContain("Loading");
  });

  it("has domain ranks for every zone", () => {
    expect(detail.ranks).toHaveLength(geo.zones.length);
    expect(detail.ranks.every((r) => r.length === 7 && r.every((v) => v >= 1 && v <= 6976))).toBe(true);
  });
});

describe("ordinal with thousands", () => {
  it("separates thousands", async () => {
    const { ordinal } = await import("../js/stage.js");
    expect(ordinal(3349)).toBe("3,349th");
    expect(ordinal(6971)).toBe("6,971st");
  });
});
