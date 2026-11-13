/**
 * A slime's mind: chooses one action from a list the engine already filtered
 * by the owner's rules. The heuristic mind is used in the simulator and as a
 * fallback; the NEAR AI Cloud mind (step 6) plugs in through the same shape.
 */
import type { Bits, SlimePersonality } from "./config";
import type { Slime } from "./types";

export type MindAction = "job" | "race" | "puzzle" | "train" | "toy" | "hat" | "save";

export type MindOption = { action: MindAction; target: string | null; cost: Bits; label: string; value?: Bits };

export type MindChoice = {
  action: MindAction;
  target: string | null;
  reason: string;
  say: string | null;
  verified: boolean | null;
  signature: string | null;
};

export type MindContext = { slime: Slime; options: MindOption[]; tick: number };

export interface Mind {
  name: string;
  decide(ctx: MindContext): MindChoice | Promise<MindChoice>;
}

const LIKES: Record<SlimePersonality, MindAction[]> = {
  thrifty: ["job", "save", "train", "puzzle", "toy", "race", "hat"],
  greedy: ["job", "race", "puzzle", "hat", "train", "toy", "save"],
  lazy: ["save", "toy", "puzzle", "job", "train", "race", "hat"],
  brave: ["race", "job", "train", "puzzle", "hat", "toy", "save"],
  social: ["toy", "hat", "job", "race", "puzzle", "train", "save"],
};

const REASONS: Record<MindAction, (o: MindOption) => string> = {
  job: (o) => `${o.label} pays well and I have the energy.`,
  race: () => "I feel fast today. Let's race!",
  puzzle: () => "A puzzle contest! My brain is ready.",
  train: (o) => `${o.label} will make me better at jobs.`,
  toy: (o) => `I deserve some fun: ${o.label.toLowerCase()}.`,
  hat: () => "A party hat makes everyone like me more.",
  save: () => "I'll keep my coins for now.",
};

/** Fast, free, personality-driven choices. Not verified (no model call). */
export const heuristicMind: Mind = {
  name: "heuristic",
  decide({ slime, options }) {
    const order = LIKES[slime.personality];
    // Lazy slimes will still work when getting poor.
    const ranked = [...options].sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action));
    const pick = ranked[0] ?? { action: "save" as const, target: null, cost: 0n, label: "Save" };
    return { action: pick.action, target: pick.target, reason: REASONS[pick.action](pick), say: null, verified: null, signature: null };
  },
};
