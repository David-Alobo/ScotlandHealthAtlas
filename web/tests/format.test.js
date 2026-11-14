import { describe, expect, it } from "vitest";
import { escapeXml, formatInt, formatLarge, formatNum, pct } from "../js/format.js";

describe("format", () => {
  it("separates thousands", () => {
    expect(formatInt(1652428)).toBe("1,652,428");
    expect(formatInt(2850.4)).toBe("2,850");
  });

  it("writes large numbers in words", () => {
    expect(formatLarge(113247207)).toBe("113 million");
    expect(formatLarge(1652428)).toBe("1.65 million");
    expect(formatLarge(54922)).toBe("54,922");
  });

  it("formats percentages and decimals", () => {
    expect(pct(0.2124)).toBe("21.2%");
    expect(pct(0.87, 0)).toBe("87%");
    expect(formatNum(380.16)).toBe("380");
    expect(formatNum(1.9, 2)).toBe("1.90");
  });

  it("escapes markup", () => {
    expect(escapeXml(`A&E <b> "x" 'y'`)).toBe("A&amp;E &lt;b&gt; &quot;x&quot; &#39;y&#39;");
  });
});
