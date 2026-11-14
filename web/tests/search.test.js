import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lookupPostcode, parseQuery, searchNames } from "../js/search.js";

const geo = JSON.parse(readFileSync(new URL("../data/geo.json", import.meta.url), "utf8"));
const pa = JSON.parse(readFileSync(new URL("../data/postcodes/PA.json", import.meta.url), "utf8"));

describe("search", () => {
  it("recognises postcodes in any spacing or case", () => {
    expect(parseQuery("pa3 2sl")).toEqual({ type: "postcode", key: "PA32SL", area: "PA" });
    expect(parseQuery("G1 1AA")).toEqual({ type: "postcode", key: "G11AA", area: "G" });
    expect(parseQuery("EH12 9DN").area).toBe("EH");
    expect(parseQuery("Ferguslie").type).toBe("name");
  });

  it("finds neighbourhoods by name, starts first", () => {
    const found = searchNames(geo.zone_names, "paisley ferg");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((i) => geo.zone_names[i].startsWith("Paisley Ferguslie"))).toBe(true);
    expect(searchNames(geo.zone_names, "a")).toEqual([]); // too short
  });

  it("looks up a postcode in its area file", () => {
    const i = lookupPostcode(pa, "PA32SL");
    expect(geo.zone_names[i]).toBe("Paisley North - 06");
    expect(lookupPostcode(pa, "PA99ZZ")).toBe(-1);
  });
});
