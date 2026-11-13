/** Turn the town into what each screen needs. No emails or keys ever leave here. */
import { BPS, ITEMS, ITEM_BY_ID, TICKS_PER_DAY } from "@/economy/config";
import { cheapestSellers } from "@/economy/market";
import { season } from "@/economy/seasons";
import { busyness } from "@/economy/shops";
import { isLonely } from "@/economy/slimes";
import { moneyState } from "@/economy/state";
import type { Shop, Slime, World } from "@/economy/types";
import type { ClockDto, DecisionDto, EventDto, ShopDto, SlimeDto, TownDto, WorldDto } from "@/lib/dto";

export function clock(world: World): ClockDto {
  return {
    tick: world.tick,
    day: Math.floor(world.tick / TICKS_PER_DAY) + 1,
    hour: world.tick % TICKS_PER_DAY,
    season: world.season,
    seasonTitle: season(world.season).title,
  };
}

export function slimeDto(world: World, s: Slime, chain: SlimeDto["chain"]): SlimeDto {
  return {
    id: s.id,
    name: s.name,
    colour: s.colour,
    personality: s.personality,
    state: moneyState(s),
    lonely: isLonely(world, s),
    energy: Math.round(s.energy),
    joy: Math.round(s.joy),
    size: s.size,
    wallet: s.wallet.toString(),
    skills: s.skills,
    job: s.job ? { kind: s.job.kind, untilTick: s.job.untilTick } : null,
    memory: s.memory.slice(-8),
    ageDays: Math.floor((world.tick - s.bornTick) / TICKS_PER_DAY),
    rules: {
      dailyLimit: s.rules.dailyLimit.toString(),
      savingsTarget: s.rules.savingsTarget.toString(),
      allowed: s.rules.allowed,
      allowedJobs: s.rules.allowedJobs,
    },
    spentToday: s.spentToday.toString(),
    chain,
  };
}

export function decisionDto(row: {
  id: number;
  tick: number;
  action: string;
  target: string | null;
  reason: string;
  say: string | null;
  cost: bigint;
  source: string;
  verified: boolean | null;
  proof: unknown;
}, txHash: string | null = null): DecisionDto {
  return { ...row, cost: row.cost.toString(), proof: (row.proof as Record<string, unknown> | null) ?? null, txHash };
}

function shopStatus(shop: Shop): ShopDto["status"] {
  if (!shop.open) return "closed";
  return busyness(shop) > 0.5 ? "busy" : "open";
}

export function shopDto(shop: Shop): ShopDto {
  return {
    id: shop.id,
    name: shop.name,
    keeper: shop.keeper,
    personality: shop.personality,
    status: shopStatus(shop),
    wallet: shop.wallet.toString(),
    prices: Object.keys(shop.targets).map((item) => ({
      item,
      title: ITEM_BY_ID.get(item)?.title ?? item,
      price: (shop.prices[item]?.price ?? 0n).toString(),
      base: (ITEM_BY_ID.get(item)?.basePrice ?? 0n).toString(),
      reason: shop.prices[item]?.reason ?? "",
      stock: shop.stock[item] ?? 0,
    })),
    buys: shop.buys,
    margin: shop.margin,
    hoard: shop.hoard,
    investors: Object.keys(shop.investors).length,
  };
}

export function eventsDto(world: World, n = 12): EventDto[] {
  return world.events.slice(-n).reverse().map((e) => ({ tick: e.tick, kind: e.kind, text: e.text }));
}

/** Up to `max` slimes for the town scene, the viewer's own first. */
export function townDto(world: World, viewerId: string | null, max = 60): TownDto {
  const all = Object.values(world.slimes);
  const mine = all.filter((s) => viewerId && s.ownerId === viewerId);
  const others = all.filter((s) => !viewerId || s.ownerId !== viewerId).slice(0, Math.max(0, max - mine.length));
  return {
    clock: clock(world),
    shops: Object.values(world.shops).map(shopDto),
    slimes: [...mine, ...others].map((s) => ({ id: s.id, name: s.name, colour: s.colour, state: moneyState(s), size: s.size, mine: s.ownerId === viewerId && viewerId !== null, working: Boolean(s.job) })),
    events: eventsDto(world),
  };
}

/** Average of price / base over every item on sale, in basis points (10_000 = normal). */
export function priceIndex(prices: Record<string, bigint>): number {
  const ratios = ITEMS.filter((i) => prices[i.id] !== undefined).map((i) => Number((prices[i.id]! * BigInt(BPS)) / i.basePrice));
  return ratios.length ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : BPS;
}

function weatherLabel(index: number): string {
  if (index > 15_000) return "Stormy: prices are high";
  if (index > 12_000) return "Cloudy: prices rising";
  if (index < 8_500) return "Breezy: bargains everywhere";
  return "Sunny: prices are steady";
}

export function worldDto(world: World): WorldDto {
  const current: Record<string, bigint> = {};
  for (const item of ITEMS) {
    const o = cheapestSellers(world, item.id)[0];
    if (o) current[item.id] = o.price;
  }
  const index = priceIndex(current);
  const history = world.history.map((d) => ({ day: d.day, index: priceIndex(d.prices) }));
  const prev = history.at(-2)?.index ?? index;
  const states: Record<string, number> = {};
  for (const s of Object.values(world.slimes)) states[moneyState(s)] = (states[moneyState(s)] ?? 0) + 1;
  return {
    clock: clock(world),
    weather: { index, label: weatherLabel(index), trend: index > prev + 300 ? "up" : index < prev - 300 ? "down" : "flat" },
    states,
    shops: Object.values(world.shops).map((s) => ({
      id: s.id,
      name: s.name,
      open: s.open,
      wallet: s.wallet.toString(),
      history: world.history.slice(-14).map((d) => (d.shopWallets[s.id] ?? 0n).toString()),
    })),
    priceIndex: history.slice(-30),
    topEarners: Object.values(world.slimes)
      .sort((a, b) => (b.earnedYesterday > a.earnedYesterday ? 1 : b.earnedYesterday < a.earnedYesterday ? -1 : 0))
      .slice(0, 5)
      .map((s) => ({ name: s.name, colour: s.colour, earned: s.earnedYesterday.toString(), state: moneyState(s) })),
    treasury: world.treasury.toString(),
    population: Object.keys(world.slimes).length,
    news: eventsDto(world, 20),
  };
}
