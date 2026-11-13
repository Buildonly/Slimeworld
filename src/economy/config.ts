/**
 * Every economy number in Slimeworld lives here, and only here.
 * Money is an integer in the smallest unit. Never a float.
 *
 * Units: in game, money is counted in whole "coins". On chain, coins are
 * NEAR held by the town contract: 1 coin = 0.001 NEAR = 10^21 yoctoNEAR.
 */

/** 1 NEAR in yoctoNEAR. */
export const YOCTO_PER_NEAR = 10n ** 24n;

/** 1 coin in yoctoNEAR (0.001 NEAR). */
export const YOCTO_PER_COIN = 10n ** 21n;

/** NEAR sent to a new player account so it can pay its own storage. */
export const PLAYER_ACCOUNT_FUNDING_YOCTO = YOCTO_PER_NEAR / 100n; // 0.01 NEAR

/** Town treasury fee on market sales, breeding and race pools, in basis points (2 to 5 percent). */
export const TREASURY_FEE_BPS = 300;

export type ItemCategory = "Food" | "Toy" | "Training" | "Hat" | "Material";

export type ItemDef = {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  /** Base price in coins. Shop prices move between 0.5x and 3x of this. */
  basePrice: number;
};

/** Every item in the town. Ids are NEP-245 token ids on the items contract. */
export const ITEMS: readonly ItemDef[] = [
  { id: "berries", title: "Berries", description: "Sweet, cheap and filling.", category: "Food", basePrice: 8 },
  { id: "jelly", title: "Jelly", description: "A wobbly treat. Lots of energy.", category: "Food", basePrice: 14 },
  { id: "cake", title: "Cake", description: "A big slice. Makes slimes very happy.", category: "Food", basePrice: 30 },
  { id: "ice", title: "Ice cube", description: "Cool on a hot day.", category: "Food", basePrice: 10 },
  { id: "ball", title: "Bouncy ball", description: "Boing! Good for play.", category: "Toy", basePrice: 25 },
  { id: "book", title: "Puzzle book", description: "Trains smarts.", category: "Training", basePrice: 40 },
  { id: "weights", title: "Tiny weights", description: "Trains speed.", category: "Training", basePrice: 40 },
  { id: "hat", title: "Party hat", description: "Charm up. Very stylish.", category: "Hat", basePrice: 60 },
  { id: "iron", title: "Iron", description: "Shops use it to make things.", category: "Material", basePrice: 4 },
  { id: "wood", title: "Wood", description: "Shops use it to make things.", category: "Material", basePrice: 3 },
];
