import { describe, expect, it } from "vitest";
import { linear, niceMax, niceTicks, spreadLabels } from "../js/scale.js";

describe("scale", () => {
  it("maps linearly, including reversed ranges", () => {
    const y = linear([0, 100], [300, 0]);
    expect(y(0)).toBe(300);
    expect(y(50)).toBe(150);
    expect(y(100)).toBe(0);
  });

  it("makes round ticks", () => {
    expect(niceTicks(0, 500)).toEqual([0, 100, 200, 300, 400, 500]);
    expect(niceTicks(0, 40)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(0, 1000)).toEqual([0, 200, 400, 600, 800, 1000]);
  });

  it("tops an axis at a round number", () => {
    expect(niceMax(429)).toBe(500);
    expect(niceMax(38.8)).toBe(40);
    expect(niceMax(964)).toBe(1000);
  });

  it("spreads end labels apart and keeps their order", () => {
    const out = spreadLabels([100, 102, 300, 101], 15);
    expect(out[0]).toBe(100);
    expect(out[3]).toBe(115);
    expect(out[1]).toBe(130);
    expect(out[2]).toBe(300);
  });

  it("leaves labels that are already apart alone", () => {
    expect(spreadLabels([10, 50, 90], 15)).toEqual([10, 50, 90]);
  });
});
