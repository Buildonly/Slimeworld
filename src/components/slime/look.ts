/**
 * How a slime looks for each money state and colour. Pure data so it can be
 * tested and reused by 2D fallbacks. Matches the table in docs/ART.md.
 */

export const SLIME_STATES = ["thriving", "fine", "hungry", "broke", "asleep"] as const;
export type SlimeState = (typeof SLIME_STATES)[number];

export const SLIME_COLOURS = ["green", "blue", "pink", "gold", "crystal", "shadow"] as const;
export type SlimeColour = (typeof SLIME_COLOURS)[number];

export type Mouth = "grin" | "smile" | "flat" | "frown" | "sleep";
export type Eyes = "open" | "look" | "grumpy" | "closed";

export type SlimeLook = {
  /** Width/depth and height multipliers on the base shape. */
  widthScale: number;
  heightScale: number;
  /** Multiplies colour saturation; 0 is grey. */
  saturation: number;
  /** Added to colour lightness (0..1 scale). */
  lighten: number;
  /** Jump height in body radii, and jumps per second. */
  bounceHeight: number;
  bounceRate: number;
  /** How much it squashes on landing (0..1). */
  squash: number;
  /** Idle breathing amount on scale. */
  breath: number;
  /** Jelly wobble strength. */
  wobble: number;
  mouth: Mouth;
  eyes: Eyes;
  blush: boolean;
  sparkles: boolean;
  sweat: boolean;
  sleeping: boolean;
};

const LOOKS: Record<SlimeState, SlimeLook> = {
  thriving: {
    widthScale: 1,
    heightScale: 1.08,
    saturation: 1.15,
    lighten: 0.03,
    bounceHeight: 0.55,
    bounceRate: 1.5,
    squash: 0.24,
    breath: 0.015,
    wobble: 1,
    mouth: "grin",
    eyes: "open",
    blush: true,
    sparkles: true,
    sweat: false,
    sleeping: false,
  },
  fine: {
    widthScale: 1,
    heightScale: 1,
    saturation: 1,
    lighten: 0,
    bounceHeight: 0.28,
    bounceRate: 1.05,
    squash: 0.16,
    breath: 0.02,
    wobble: 0.8,
    mouth: "smile",
    eyes: "open",
    blush: true,
    sparkles: false,
    sweat: false,
    sleeping: false,
  },
  hungry: {
    widthScale: 0.9,
    heightScale: 0.86,
    saturation: 0.95,
    lighten: 0,
    bounceHeight: 0.12,
    bounceRate: 0.6,
    squash: 0.1,
    breath: 0.02,
    wobble: 0.6,
    mouth: "flat",
    eyes: "look",
    blush: false,
    sparkles: false,
    sweat: false,
    sleeping: false,
  },
  broke: {
    widthScale: 1.2,
    heightScale: 0.7,
    saturation: 0.35,
    lighten: 0.12,
    bounceHeight: 0.025,
    bounceRate: 0.35,
    squash: 0.04,
    breath: 0.012,
    wobble: 0.35,
    mouth: "frown",
    eyes: "grumpy",
    blush: false,
    sparkles: false,
    sweat: true,
    sleeping: false,
  },
  asleep: {
    widthScale: 1.12,
    heightScale: 0.62,
    saturation: 0,
    lighten: 0.05,
    bounceHeight: 0,
    bounceRate: 0,
    squash: 0,
    breath: 0.035,
    wobble: 0.15,
    mouth: "sleep",
    eyes: "closed",
    blush: false,
    sparkles: false,
    sweat: false,
    sleeping: true,
  },
};

export function lookFor(state: SlimeState): SlimeLook {
  return LOOKS[state];
}

export type ColourStyle = { hex: string; opacity: number; alwaysSparkle: boolean; rarity: number };

/** Base colours by rarity (common first). */
export const COLOUR_STYLES: Record<SlimeColour, ColourStyle> = {
  green: { hex: "#57d18f", opacity: 0.93, alwaysSparkle: false, rarity: 0 },
  blue: { hex: "#5aa9ff", opacity: 0.93, alwaysSparkle: false, rarity: 1 },
  pink: { hex: "#ff8fc7", opacity: 0.93, alwaysSparkle: false, rarity: 2 },
  gold: { hex: "#ffc93c", opacity: 0.95, alwaysSparkle: false, rarity: 3 },
  crystal: { hex: "#cfeeff", opacity: 0.6, alwaysSparkle: true, rarity: 4 },
  shadow: { hex: "#6b3fa0", opacity: 0.94, alwaysSparkle: false, rarity: 5 },
};

/**
 * Height of a bounce at phase p (0..1, landing at 0 and 1): a parabola.
 */
export function bounceHeightAt(p: number, height: number): number {
  const t = p - Math.floor(p);
  return height * 4 * t * (1 - t);
}

/**
 * Squash and stretch for a bounce phase: flatter and wider on landing,
 * taller and thinner mid-jump. Volume stays about the same.
 */
export function squashStretchAt(p: number, squash: number): { y: number; xz: number } {
  const t = p - Math.floor(p);
  const nearGround = Math.max(0, 1 - Math.min(t, 1 - t) / 0.14);
  const speed = Math.abs(1 - 2 * t);
  const y = 1 - squash * nearGround + squash * 0.6 * speed * (1 - nearGround);
  return { y, xz: 1 / Math.sqrt(y) };
}
