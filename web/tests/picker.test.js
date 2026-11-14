import { describe, expect, it } from "vitest";
import { findTyped, moveIndex } from "../js/picker.js";

describe("picker", () => {
  it("moves within the list and stops at its ends", () => {
    expect(moveIndex(0, "ArrowDown", 5)).toBe(1);
    expect(moveIndex(4, "ArrowDown", 5)).toBe(4);
    expect(moveIndex(0, "ArrowUp", 5)).toBe(0);
    expect(moveIndex(2, "Home", 5)).toBe(0);
    expect(moveIndex(2, "End", 5)).toBe(4);
    expect(moveIndex(1, "PageDown", 5)).toBe(4);
    expect(moveIndex(3, "PageUp", 33)).toBe(0);
    expect(moveIndex(2, "x", 5)).toBe(2);
    expect(moveIndex(-1, "ArrowDown", 0)).toBe(-1);
  });

  it("jumps to the first option starting with what was typed, wrapping round", () => {
    const labels = ["All of Scotland", "Aberdeen City", "Aberdeenshire", "Dundee City", "Fife"];
    expect(findTyped(labels, "d")).toBe(3);
    expect(findTyped(labels, "ABERDEENS")).toBe(2);
    expect(findTyped(labels, "a", 3)).toBe(0); // from Dundee City on, wrapping to All
    expect(findTyped(labels, "z")).toBe(-1);
    expect(findTyped(labels, "")).toBe(-1);
  });
});
