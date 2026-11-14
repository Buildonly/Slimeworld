/**
 * The state of the whole town. Plain data (money as bigint) so the engine can
 * run headless in the simulator, on the server ticker, and in tests.
 */
import type { Bits, ItemCategory, JobKind, Margin, SeasonId, ShopPersonality, SlimePersonality } from "./config";
import type { Rng } from "./rng";

export type SlimeColour = "green" | "blue" | "pink" | "gold" | "crystal" | "shadow";
export type Skills = { speed: number; smarts: number; charm: number };

/** The owner's controls for one slime (mirrors the town contract's rules). */
export type Rules = {
  dailyLimit: Bits;
  allowed: ItemCategory[];
  allowedJobs: JobKind[];
  savingsTarget: Bits;
};

export type ActiveJob = { jobId: string; kind: JobKind; shopId: string | null; wage: Bits; untilTick: number; success: boolean };

export type Slime = {
  id: string;
  name: string;
  /** Player id, or null for town slimes nobody owns. */
  ownerId: string | null;
  colour: SlimeColour;
  personality: SlimePersonality;
  skills: Skills;
  size: number;
  bornTick: number;
  energy: number;
  joy: number;
  wallet: Bits;
  items: Record<string, number>;
  rules: Rules;
  spentToday: Bits;
  earnedToday: Bits;
  earnedYesterday: Bits;
  job: ActiveJob | null;
  asleep: boolean;
  lastThinkTick: number;
  /** Last time a player played with or fed it. Town slimes never get lonely. */
  lastCareTick: number;
  /** Short life log, newest last. */
  memory: string[];
  friends: string[];
  /** Races and puzzle contests won. */
  wins: number;
  /** Every coin earned since hatching: wages, prizes and sales. */
  earnedTotal: Bits;
  /** Cheers from other players. */
  cheers: number;
};

export type PricePoint = { price: Bits; reason: string };

export type Shop = {
  id: string;
  name: string;
  keeper: string;
  personality: ShopPersonality;
  /** 1 = sized for SHOP_SIZE_FOR_SLIMES slimes. Scales stock and rent. */
  size: number;
  wallet: Bits;
  stock: Record<string, number>;
  targets: Record<string, number>;
  buys: string[];
  /** Sales per item for each of the last 24 ticks, newest last. */
  salesWindow: Record<string, number[]>;
  avgSales: Record<string, number>;
  prices: Record<string, PricePoint>;
  margin: Margin;
  hoard: string | null;
  hires: number;
  open: boolean;
  troubleTicks: number;
  closedAtTick: number | null;
  /** Investor id -> coins invested (shares). */
  investors: Record<string, Bits>;
  incomeToday: Bits;
  costsToday: Bits;
};

export type Job = {
  id: string;
  kind: JobKind;
  /** Shop paying the wage, or null when paid by players outside town (guards). */
  shopId: string | null;
  wage: Bits;
  postedTick: number;
};

export type Contest = { id: string; kind: "race" | "puzzle"; entry: Bits; entrants: string[]; pot: Bits; settlesAt: number };

export type CareStyle = "devoted" | "casual" | "absent" | "real";
export type Player = { id: string; name: string; wallet: Bits; care: CareStyle };

export type GameEventKind =
  | "shop_closed"
  | "shop_reopened"
  | "invested"
  | "season"
  | "contest"
  | "asleep"
  | "woke"
  | "fed_by_friend"
  | "hoard"
  | "cheered"
  | "gift"
  | "invited";

export type GameEvent = { tick: number; kind: GameEventKind; text: string; shopId?: string; slimeId?: string };

/** Every slime and shop decision, stored with its reason, cost and verification. */
export type Decision = {
  tick: number;
  actorId: string;
  actorKind: "slime" | "shop";
  action: string;
  target: string | null;
  reason: string;
  say: string | null;
  cost: Bits;
  /** "rule" for cheap rules, otherwise the mind that chose (e.g. "heuristic", "near-ai"). */
  source: string;
  verified: boolean | null;
  signature: string | null;
  /** Evidence for verified decisions, stored as JSON. */
  proof?: Record<string, unknown> | null;
};

/** Money that entered or left the town, for checking the books. */
export type Flows = { visitors: Bits; guardPay: Bits; topUps: Bits; wholesale: Bits; rent: Bits; thinking: Bits; prizes: Bits };

export type DaySnapshot = {
  day: number;
  /** Average sell price per item across open shops that sell it. */
  prices: Record<string, Bits>;
  shopWallets: Record<string, Bits>;
  shopsOpen: number;
  states: Record<string, number>;
  wealth: { p10: Bits; p50: Bits; p90: Bits; total: Bits };
  treasury: Bits;
};

export type World = {
  tick: number;
  rng: Rng;
  season: SeasonId;
  slimes: Record<string, Slime>;
  shops: Record<string, Shop>;
  players: Record<string, Player>;
  jobs: Job[];
  contests: Contest[];
  treasury: Bits;
  flows: Flows;
  history: DaySnapshot[];
  events: GameEvent[];
  nextId: number;
  /** Money moves of the current tick (cleared each tick). */
  journal: import("./journal").Move[];
};

/** What one tick produced, for the log and the database. */
export type TickOutput = { decisions: Decision[]; events: GameEvent[]; moves: import("./journal").Move[] };
