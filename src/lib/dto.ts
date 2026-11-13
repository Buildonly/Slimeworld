/**
 * Shapes the API sends to the browser. Money is sent as a string of bits
 * (1/100 coin) so it stays an exact integer; format it with formatBits.
 */
import type { MoneyState } from "@/economy/state";
import type { Rules, SlimeColour } from "@/economy/types";

export type BitsStr = string;

export type SlimeDto = {
  id: string;
  name: string;
  colour: SlimeColour;
  personality: string;
  state: MoneyState;
  lonely: boolean;
  energy: number;
  joy: number;
  size: number;
  wallet: BitsStr;
  skills: { speed: number; smarts: number; charm: number };
  job: { kind: string; untilTick: number } | null;
  memory: string[];
  ageDays: number;
  rules: { dailyLimit: BitsStr; savingsTarget: BitsStr; allowed: Rules["allowed"]; allowedJobs: Rules["allowedJobs"] };
  spentToday: BitsStr;
  chain: { accountId: string; nftTokenId: string; status: string } | null;
};

export type DecisionDto = {
  id: number;
  tick: number;
  action: string;
  target: string | null;
  reason: string;
  say: string | null;
  cost: BitsStr;
  source: string;
  verified: boolean | null;
  proof: Record<string, unknown> | null;
  txHash: string | null;
};

export type ClockDto = { tick: number; day: number; hour: number; season: string; seasonTitle: string };

export type HomeDto = {
  clock: ClockDto;
  player: { id: string; wallet: BitsStr; nearAccountId: string | null } | null;
  slimes: SlimeDto[];
  recent: Record<string, DecisionDto[]>;
  feedPrice: BitsStr | null;
  contracts: { town: string; nft: string; items: string; network: string };
};

export type PriceDto = { item: string; title: string; price: BitsStr; base: BitsStr; reason: string; stock: number };

export type ShopDto = {
  id: string;
  name: string;
  keeper: string;
  personality: string;
  status: "open" | "busy" | "closed";
  wallet: BitsStr;
  prices: PriceDto[];
  buys: string[];
  margin: string;
  hoard: string | null;
  investors: number;
};

export type TownSlimeDto = { id: string; name: string; colour: SlimeColour; state: MoneyState; size: number; mine: boolean; working: boolean };

export type EventDto = { tick: number; kind: string; text: string };

export type TownDto = { clock: ClockDto; shops: ShopDto[]; slimes: TownSlimeDto[]; events: EventDto[] };

export type ItemDto = {
  id: string;
  title: string;
  description: string;
  category: string;
  base: BitsStr;
  best: { price: BitsStr; shopId: string; shopName: string; reason: string } | null;
  history: { day: number; price: BitsStr }[];
};

export type MarketDto = { clock: ClockDto; items: ItemDto[] };

export type WorldDto = {
  clock: ClockDto;
  weather: { index: number; label: string; trend: "up" | "down" | "flat" };
  states: Record<string, number>;
  shops: { id: string; name: string; open: boolean; wallet: BitsStr; history: BitsStr[] }[];
  priceIndex: { day: number; index: number }[];
  topEarners: { name: string; colour: SlimeColour; earned: BitsStr; state: MoneyState }[];
  treasury: BitsStr;
  population: number;
  news: EventDto[];
};
