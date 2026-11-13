import { describe, expect, it } from "vitest";
import { pitchFor, VOICES } from "./settings";

describe("slime voices", () => {
  it("has a voice for every personality", () => {
    expect(Object.keys(VOICES).sort()).toEqual(["brave", "greedy", "lazy", "social", "thrifty"]);
  });
  it("sounds higher when young and settles as it grows", () => {
    expect(pitchFor(0.8)).toBeGreaterThan(pitchFor(1.1));
    expect(pitchFor(1.4)).toBeGreaterThanOrEqual(1.1);
    expect(pitchFor(5)).toBe(pitchFor(1.4));
  });
});
