import { describe, expect, it } from "vitest";
import { bounceHeightAt, lookFor, SLIME_STATES, squashStretchAt } from "./look";

describe("slime look", () => {
  it("bounces less as the slime does worse", () => {
    const heights = SLIME_STATES.map((s) => lookFor(s).bounceHeight);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]!);
  });

  it("is grey and still when asleep, pale and flat when broke", () => {
    expect(lookFor("asleep").saturation).toBe(0);
    expect(lookFor("asleep").bounceHeight).toBe(0);
    expect(lookFor("broke").saturation).toBeLessThan(0.5);
    expect(lookFor("broke").heightScale).toBeLessThan(lookFor("fine").heightScale);
    expect(lookFor("broke").widthScale).toBeGreaterThan(lookFor("fine").widthScale);
  });

  it("only sparkles when thriving and only sweats when broke", () => {
    expect(SLIME_STATES.filter((s) => lookFor(s).sparkles)).toEqual(["thriving"]);
    expect(SLIME_STATES.filter((s) => lookFor(s).sweat)).toEqual(["broke"]);
  });

  it("lands on the ground and peaks mid-jump", () => {
    expect(bounceHeightAt(0, 1)).toBe(0);
    expect(bounceHeightAt(0.5, 1)).toBeCloseTo(1);
    expect(bounceHeightAt(1.25, 1)).toBeCloseTo(bounceHeightAt(0.25, 1));
  });

  it("squashes on landing and keeps volume", () => {
    const landing = squashStretchAt(0, 0.2);
    expect(landing.y).toBeLessThan(1);
    expect(landing.xz).toBeGreaterThan(1);
    expect(landing.y * landing.xz * landing.xz).toBeCloseTo(1);
    const rising = squashStretchAt(0.25, 0.2);
    expect(rising.y).toBeGreaterThan(1);
  });
});
