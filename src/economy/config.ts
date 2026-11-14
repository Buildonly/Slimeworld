/**
 * Every economy number in Slimeworld lives here, and only here, so the town
 * can be tuned without touching logic. Run `pnpm sim` after any change.
 *
 * Money is an integer in the smallest unit, the "bit". Never a float.
 *   100 bits = 1 coin. On chain, 1 coin = 0.001 NEAR held by the town contract.
 *
 * Multipliers that are not money (stock, demand, personality...) are written
 * in basis points: 10_000 = 1.0x.
 */

// ---------- units ----------

/** Smallest unit of game money. */
export type Bits = bigint;

export const BITS_PER_COIN = 100n;
/** Whole coins to bits, for writing prices below. */
export const coins = (n: number): Bits => BigInt(n) * BITS_PER_COIN;

/** 1 NEAR in yoctoNEAR. */
export const YOCTO_PER_NEAR = 10n ** 24n;
/** 1 coin in yoctoNEAR (0.001 NEAR). */
export const YOCTO_PER_COIN = 10n ** 21n;
/** 1 bit in yoctoNEAR. */
export const YOCTO_PER_BIT = YOCTO_PER_COIN / BITS_PER_COIN;

/** 1.0x in basis points. */
export const BPS = 10_000;

// ---------- chain ----------

/**
 * Free play coins each new player's slime and purse start with. Coins have
 * no cash value: they live on the testnet town, and top ups only buy more.
 */
export const STARTER_COINS: { slime: Bits; purse: Bits } = { slime: coins(250), purse: coins(125) };

/** Town treasury fee on market sales, breeding and race pools (2 to 5 percent). */
export const TREASURY_FEE_BPS = 300;

// ---------- time ----------

/** One tick is one game hour. */
export const TICKS_PER_DAY = 24;
/** Real seconds per tick: normal play and fast forward (1 day per 10 seconds). */
export const TICK_SECONDS_NORMAL = 60;
export const TICK_SECONDS_FAST = 10 / TICKS_PER_DAY;
/** Most ticks one catch-up runs when the town wakes after a quiet spell; the rest follow on the next visit. */
export const CATCH_UP_TICKS_PER_CALL = 24;
/**
 * The town contract counts spending per real day; the game per game day.
 * On chain, an owner's daily limit is registered as limit x game days per
 * real day, which is the same spending rate.
 */
export const GAME_DAYS_PER_REAL_DAY = (24 * 60 * 60) / (TICKS_PER_DAY * TICK_SECONDS_NORMAL);

// ---------- items ----------

export type ItemCategory = "Food" | "Toy" | "Training" | "Hat" | "Material";

export type ItemDef = {
  id: string;
  title: string;
  description: string;
  category: ItemCategory;
  /** Base price. Shop prices stay between 0.5x and 3x of this. */
  basePrice: Bits;
  /** Energy restored when eaten (food only). */
  energy?: number;
  /** Happiness when used. */
  joy?: number;
  /** Skill trained when used. */
  trains?: "speed" | "smarts" | "charm";
};

/** Every item in the town. Ids are NEP-245 token ids on the items contract. */
export const ITEMS: readonly ItemDef[] = [
  { id: "berries", title: "Berries", description: "Sweet, cheap and filling.", category: "Food", basePrice: coins(8), energy: 22 },
  { id: "jelly", title: "Jelly", description: "A wobbly treat. Lots of energy.", category: "Food", basePrice: coins(14), energy: 40, joy: 2 },
  { id: "cake", title: "Cake", description: "A big slice. Makes slimes very happy.", category: "Food", basePrice: coins(30), energy: 70, joy: 6 },
  { id: "ice", title: "Ice cube", description: "Cool on a hot day.", category: "Food", basePrice: coins(10), energy: 20, joy: 3 },
  { id: "ball", title: "Bouncy ball", description: "Boing! Good for play.", category: "Toy", basePrice: coins(25), joy: 30 },
  { id: "book", title: "Puzzle book", description: "Trains smarts.", category: "Training", basePrice: coins(40), trains: "smarts", joy: 4 },
  { id: "weights", title: "Tiny weights", description: "Trains speed.", category: "Training", basePrice: coins(40), trains: "speed", joy: 4 },
  { id: "hat", title: "Party hat", description: "Charm up. Very stylish.", category: "Hat", basePrice: coins(60), trains: "charm", joy: 20 },
  { id: "iron", title: "Iron", description: "Shops use it to make things.", category: "Material", basePrice: coins(4) },
  { id: "wood", title: "Wood", description: "Shops use it to make things.", category: "Material", basePrice: coins(3) },
];

export const ITEM_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));

/** Skill points a training item or a successful job adds (skills run 1 to 100). */
export const TRAINING_GAIN = 4;
export const JOB_SKILL_GAIN = 1;

// ---------- pricing (see pricing.ts) ----------

/** Shop price limits around the base price. */
export const PRICE_MIN_BPS = 5_000; // 0.5x
export const PRICE_MAX_BPS = 30_000; // 3x
/** stockFactor = clamp(target / max(stock, 1), 0.5, 3) */
export const STOCK_FACTOR_MIN_BPS = 5_000;
export const STOCK_FACTOR_MAX_BPS = 30_000;
/** demandFactor = clamp(1 + (sales24h - avg) / avg x 0.5, 0.7, 2) */
export const DEMAND_SENSITIVITY_BPS = 5_000;
export const DEMAND_FACTOR_MIN_BPS = 7_000;
export const DEMAND_FACTOR_MAX_BPS = 20_000;
/** How fast a shop's idea of "normal daily sales" follows real sales (per day). */
export const AVG_SALES_SMOOTHING_BPS = 2_500;

export type ShopPersonality = "greedy" | "fair" | "generous";
export const PERSONALITY_FACTOR_BPS: Record<ShopPersonality, number> = { greedy: 11_500, fair: 10_000, generous: 9_000 };

export type Margin = "low" | "normal" | "high";
/** The shopkeeper mind picks a margin each day; it nudges price inside the limits. */
export const MARGIN_FACTOR_BPS: Record<Margin, number> = { low: 9_200, normal: 10_000, high: 11_000 };

/** A shop buys from players at price x buyMargin, less when it is already full. */
export const BUY_MARGIN_BPS = 6_000;
/** Share of a shop's stock target it keeps back when hoarding an item. */
export const HOARD_HOLD_BPS = 5_000;

// ---------- shops ----------

/** What shops pay to restock from the farms and mines outside town (money leaves the economy). */
export const WHOLESALE_BPS = 6_500;
/** A shop restocks an item when stock falls below this share of its target. */
export const RESTOCK_BELOW_BPS = 8_000;
/** Fixed costs per shop per day, for a shop sized for SHOP_SIZE_FOR_SLIMES slimes (scales with size). */
export const SHOP_RENT_PER_DAY: Bits = coins(30);
/** Closed shops still owe a little upkeep. */
export const CLOSED_SHOP_RENT_PER_DAY: Bits = coins(4);
/** A shop that cannot pay its way for this many ticks closes. */
export const BANKRUPT_AFTER_TICKS = TICKS_PER_DAY;
/** Share of each day's profit paid to investors. */
export const INVESTOR_PROFIT_SHARE_BPS = 3_000;
/** Smallest investment that reopens a closed shop. */
export const MIN_REOPEN_INVESTMENT: Bits = coins(300);

// ---------- jobs ----------

export type JobKind = "delivery" | "helper" | "guard" | "race" | "puzzle";

export type JobDef = {
  kind: JobKind;
  title: string;
  /** Skill that decides success. Guard uses size. */
  skill: "speed" | "smarts" | "charm" | "size";
  baseWage: Bits;
  /** Ticks the slime is busy. */
  ticks: number;
  energyCost: number;
};

export const JOBS: Record<"delivery" | "helper" | "guard", JobDef> = {
  delivery: { kind: "delivery", title: "Delivery", skill: "speed", baseWage: coins(14), ticks: 2, energyCost: 14 },
  helper: { kind: "helper", title: "Shop helper", skill: "charm", baseWage: coins(12), ticks: 3, energyCost: 10 },
  guard: { kind: "guard", title: "Guard", skill: "size", baseWage: coins(16), ticks: 4, energyCost: 12 },
};

/** Wage = baseWage x (1 + busyness), capped at this share of the shop's wallet. */
export const MAX_WAGE_SHARE_OF_WALLET_BPS = 1_500;
/** Delivery jobs may also turn up a material item. */
export const DELIVERY_FIND_CHANCE_BPS = 2_500;
/** Success chance = base + skill bonus (skill 1..100) + happiness bonus. */
export const JOB_BASE_SUCCESS_BPS = 5_500;
export const JOB_SKILL_SUCCESS_BPS_PER_POINT = 40;
export const JOB_JOY_SUCCESS_BPS_PER_POINT = 15;

/** Races and puzzle contests: entry pool, winner takes most, treasury keeps its fee. */
export const CONTESTS = {
  race: { title: "Race", skill: "speed" as const, entry: coins(10), energyCost: 18, everyTicks: 6 },
  puzzle: { title: "Puzzle contest", skill: "smarts" as const, entry: coins(10), energyCost: 8, everyTicks: 8 },
};
/** Winner's share of the pool after the fee; runner up gets the rest. */
export const CONTEST_WINNER_SHARE_BPS = 7_000;

// ---------- slimes ----------

export type SlimePersonality = "thrifty" | "greedy" | "lazy" | "brave" | "social";

/** Energy lost per tick, and the levels where it gets hungry or must eat. */
export const ENERGY_DECAY_PER_TICK = 0.9;
export const HUNGRY_BELOW = 40;
export const STARVING_BELOW = 20;
/** Happiness lost per tick without care, and floor for town (unowned) slimes. */
export const JOY_DECAY_PER_TICK = 1.0;
export const TOWN_SLIME_JOY_FLOOR = 45;

/** Starter balance a newly hatched slime gets. */
export const STARTER_WALLET: Bits = coins(250);
/** Default owner rules for a new slime. */
export const DEFAULT_RULES = {
  dailyLimit: coins(120),
  allowed: ["Food", "Training", "Toy"] as ItemCategory[],
  allowedJobs: ["delivery", "helper", "guard", "race", "puzzle"] as JobKind[],
  savingsTarget: coins(20),
};
/** Owners who care raise the savings floor on the Rules screen; simulated caring owners do this. */
export const CARING_OWNER_SAVINGS_TARGET: Bits = coins(60);

/** What one AI decision costs the slime (paid for its NEAR AI Cloud call). */
export const THINK_COST: Bits = 40n; // 0.4 coin
/** Rich slimes think every tick; poorer ones less often. */
export const THINK_EVERY_TICKS = [
  { walletAtLeast: coins(400), every: 1 },
  { walletAtLeast: coins(150), every: 3 },
  { walletAtLeast: coins(30), every: 6 },
  { walletAtLeast: 1n, every: 12 },
];

/** Money states for the look on screen. */
export const BROKE_BELOW: Bits = coins(25);
export const THRIVING_ABOVE: Bits = coins(110);

/** Growth: size rises with age while happy and fed. */
export const GROWTH_PER_DAY = 0.02;
export const MAX_SIZE = 1.4;

// ---------- owners (players) ----------

/** How often owners in the simulation look after their slime, in ticks. */
export const OWNER_CARE_EVERY: Record<"devoted" | "casual" | "absent", number> = { devoted: 12, casual: 72, absent: 0 };
/** Joy from a pat or play by the owner. */
export const OWNER_PLAY_JOY = 25;
/** Simulated owners top up a slime that drops below this. */
export const OWNER_TOP_UP_BELOW: Bits = coins(40);
export const OWNER_TOP_UP_AMOUNT: Bits = coins(80);

// ---------- seasons ----------

export type SeasonId = "calm" | "heatwave" | "harvest" | "festival";

export type Season = {
  id: SeasonId;
  title: string;
  /** Price factor per item for shops (basis points). */
  priceBps: Partial<Record<string, number>>;
  /** Demand multiplier: how much more slimes want this item. */
  demandBps: Partial<Record<string, number>>;
};

export const SEASONS: Record<SeasonId, Season> = {
  calm: { id: "calm", title: "Calm days", priceBps: {}, demandBps: {} },
  heatwave: { id: "heatwave", title: "Heat wave", priceBps: { ice: 14_000 }, demandBps: { ice: 30_000 } },
  harvest: { id: "harvest", title: "Harvest", priceBps: { berries: 8_000, jelly: 9_000 }, demandBps: { berries: 15_000 } },
  festival: { id: "festival", title: "Festival", priceBps: { hat: 12_000, ball: 11_000 }, demandBps: { hat: 25_000, ball: 20_000 } },
};
/** Seasons change weekly, in this order. */
export const SEASON_CYCLE: SeasonId[] = ["calm", "heatwave", "calm", "harvest", "calm", "festival"];
export const SEASON_DAYS = 7;
/** The treasury spends this share of its coins on prizes at each season change. */
export const SEASON_PRIZE_SHARE_BPS = 5_000;

// ---------- the starting town ----------

/** Starting shops are sized for this many slimes; bigger towns scale stock and wallets. */
export const SHOP_SIZE_FOR_SLIMES = 100;

export type ShopSeed = {
  id: string;
  name: string;
  keeper: string;
  personality: ShopPersonality;
  /** Items it sells and how many it likes to keep. */
  stockTargets: Record<string, number>;
  /** Items it buys from slimes (materials). */
  buys: string[];
  wallet: Bits;
};

export const STARTING_SHOPS: ShopSeed[] = [
  { id: "bakery", name: "Bun's Bakery", keeper: "Bun", personality: "fair", stockTargets: { berries: 60, jelly: 30, cake: 12 }, buys: [], wallet: coins(900) },
  { id: "pantry", name: "Pip's Pantry", keeper: "Pip", personality: "greedy", stockTargets: { berries: 40, jelly: 20 }, buys: [], wallet: coins(450) },
  { id: "icehut", name: "Frosty's Ice Hut", keeper: "Frosty", personality: "greedy", stockTargets: { ice: 30, berries: 12 }, buys: [], wallet: coins(450) },
  { id: "toys", name: "Bop's Toys", keeper: "Bop", personality: "generous", stockTargets: { ball: 12, hat: 6 }, buys: [], wallet: coins(600) },
  { id: "school", name: "Professor Goo's", keeper: "Goo", personality: "fair", stockTargets: { book: 10, weights: 10 }, buys: [], wallet: coins(600) },
  { id: "smithy", name: "Clank's Smithy", keeper: "Clank", personality: "greedy", stockTargets: { iron: 60, wood: 60 }, buys: ["iron", "wood"], wallet: coins(500) },
];

/** Materials a workshop uses up to make one of its goods. */
export const RECIPES: Partial<Record<string, Record<string, number>>> = {
  ball: { wood: 1 },
  hat: { wood: 2 },
  book: { wood: 2 },
  weights: { iron: 3 },
};

/** Names for town slimes. */
export const SLIME_NAMES = [
  "Blub", "Wobble", "Goopy", "Mochi", "Pudding", "Jiggles", "Bloop", "Squish", "Dollop", "Gloop",
  "Boba", "Tapioca", "Marsh", "Drip", "Puddle", "Splat", "Gummy", "Jello", "Fizz", "Noodle",
];

// ---------- money from outside town ----------

/** Visitors from outside town shop here too. Tries per open shop per tick, in basis points (10_000 = one try). */
export const VISITOR_TRIES_PER_SHOP_BPS = 11_000;
/** Visitors walk away when a price is above this multiple of base. */
export const VISITOR_MAX_PRICE_BPS = 14_000;
/** Guard jobs are paid by players protecting their storage: new guard jobs per tick per 100 slimes (bps). */
export const GUARD_JOBS_PER_TICK_PER_100_SLIMES_BPS = 9_000;
/** Open jobs a shop keeps posted: 1 + busyness x this, plus helpers its keeper chose to hire. */
export const JOBS_PER_BUSY_SHOP = 3;
/** A restock of this many units needs one delivery job. */
export const UNITS_PER_DELIVERY = 10;
/** A shop with more than this many days of rent saved cuts prices and hires more help. */
export const RICH_SHOP_RENT_DAYS = 15;
export const MAX_HIRES = 6;
/** Crafting with the right materials in stock cuts the restock cost to this share. */
export const CRAFT_COST_BPS = 5_000;
/** A slime nobody has played with for this long gets lonely: it stops working and comfort-buys treats. */
export const LONELY_AFTER_TICKS = 24;
/** Chance per day that a devoted player invests in a closed shop (bps). */
export const INVEST_CHANCE_PER_DAY_BPS = 1_200;
