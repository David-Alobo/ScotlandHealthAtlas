import { describe, expect, it } from "vitest";
import { ease, fit, hexToRgb, lerp, lerpRgb, lerpTransform, progress } from "../js/anim.js";

describe("anim", () => {
  it("eases from 0 to 1, symmetric, clamped", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25)).toBeCloseTo(1 - ease(0.75));
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });

  it("interpolates numbers, colours and transforms", () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(hexToRgb("#22d3ee")).toEqual([34, 211, 238]);
    expect(lerpRgb([0, 0, 0], [100, 200, 50], 0.5)).toEqual([50, 100, 25]);
    expect(lerpTransform({ tx: 0, ty: 0, s: 1 }, { tx: 10, ty: -10, s: 3 }, 0.5)).toEqual({ tx: 5, ty: -5, s: 2 });
  });

  it("delays items by a scattered amount within the spread", () => {
    expect(progress(1000, 0, 1000)).toBe(1);
    expect(progress(500, 0, 1000, 0, 400)).toBeCloseTo(0.5);
    expect(progress(500, 0, 1000, 5, 400)).toBeLessThan(0.5); // item 5 starts 185 ms later
    expect(progress(1400, 0, 1000, 5, 400)).toBe(1);
  });

  it("fits a viewBox like preserveAspectRatio meet", () => {
    expect(fit(1000, 500, 2000, 2000)).toEqual({ k: 2, ox: 0, oy: 500 });
    expect(fit(600, 900, 300, 900)).toEqual({ k: 0.5, ox: 0, oy: 225 });
  });
});
