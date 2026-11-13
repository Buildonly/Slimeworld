/**
 * Shopkeepers: rent, restocking, jobs, visitors from outside town, daily
 * strategy, bankruptcy and reopening through investment.
 */
import {
  BANKRUPT_AFTER_TICKS,
  BPS,
  CLOSED_SHOP_RENT_PER_DAY,
  CRAFT_COST_BPS,
  INVESTOR_PROFIT_SHARE_BPS,
  ITEM_BY_ID,
  JOBS,
  JOBS_PER_BUSY_SHOP,
  MAX_HIRES,
  RICH_SHOP_RENT_DAYS,
  UNITS_PER_DELIVERY,
  MAX_WAGE_SHARE_OF_WALLET_BPS,
  RECIPES,
  RESTOCK_BELOW_BPS,
  SHOP_RENT_PER_DAY,
  TICKS_PER_DAY,
  VISITOR_MAX_PRICE_BPS,
  VISITOR_TRIES_PER_SHOP_BPS,
  WHOLESALE_BPS,
  type Bits,
  type Margin,
} from "./config";
import { nextWorldId } from "./ids";
import { playerParty, record, shopParty } from "./journal";
import { cheapestSellers, quoteSell, refreshPrices, rollSalesWindows, sellableStock, sellOne } from "./market";
import { chance, pick } from "./rng";
import { seasonDemandBps } from "./seasons";
import type { Decision, GameEvent, Shop, World } from "./types";

const AVG_SMOOTHING = 0.25;

/** How busy a shop is: today's sales against normal, 0 (quiet) to 1 (very busy). */
export function busyness(shop: Shop): number {
  let sales = 0;
  let normal = 0;
  for (const [item, window] of Object.entries(shop.salesWindow)) {
    sales += window.reduce((a, b) => a + b, 0);
    normal += shop.avgSales[item] ?? 0;
  }
  if (normal <= 0) return 0;
  return Math.max(0, Math.min(1, sales / normal - 0.5));
}

/** Wage = baseWage x (1 + busyness), capped by what the shop can afford. */
export function wageFor(shop: Shop, baseWage: Bits): Bits {
  const wage = (baseWage * BigInt(Math.round((1 + busyness(shop)) * BPS))) / BigInt(BPS);
  const cap = (shop.wallet * BigInt(MAX_WAGE_SHARE_OF_WALLET_BPS)) / BigInt(BPS);
  return wage < cap ? wage : cap;
}

function postJob(world: World, shop: Shop, kind: "delivery" | "helper"): boolean {
  const wage = wageFor(shop, JOBS[kind].baseWage);
  if (wage < JOBS[kind].baseWage / 2n || wage > shop.wallet) return false;
  shop.wallet -= wage; // held until the job is done (like the town contract's escrow)
  world.jobs.push({ id: nextWorldId(world, "j"), kind, shopId: shop.id, wage, postedTick: world.tick });
  return true;
}

function dailyRent(shop: Shop): Bits {
  const perDay = shop.open ? SHOP_RENT_PER_DAY : CLOSED_SHOP_RENT_PER_DAY;
  return (perDay * BigInt(Math.round(shop.size * 100))) / 100n;
}

function payRent(world: World, shop: Shop): boolean {
  const rent = dailyRent(shop) / BigInt(TICKS_PER_DAY);
  const paid = rent < shop.wallet ? rent : shop.wallet;
  shop.wallet -= paid;
  shop.costsToday += paid;
  world.flows.rent += paid;
  return paid === rent;
}

/**
 * Workshops buy the materials for a batch from the cheapest other shop
 * (usually the smithy), so materials found by slimes flow into toys and books.
 */
function buyMaterials(world: World, shop: Shop, recipe: Record<string, number>, units: number): void {
  for (const [material, perUnit] of Object.entries(recipe)) {
    let need = perUnit * units - (shop.stock[material] ?? 0);
    while (need > 0) {
      const offer = cheapestSellers(world, material).find((o) => o.shop.id !== shop.id);
      if (!offer || offer.price * 3n > shop.wallet) return;
      shop.wallet -= offer.price;
      shop.costsToday += offer.price;
      shop.stock[material] = (shop.stock[material] ?? 0) + 1;
      sellOne(offer.shop, material, offer.price);
      need -= 1;
    }
  }
}

/** Restock items that are running low. Returns false if it needed to and could not. */
function restock(world: World, shop: Shop): boolean {
  let okay = true;
  for (const [itemId, target] of Object.entries(shop.targets)) {
    const have = shop.stock[itemId] ?? 0;
    if (have * BPS >= target * RESTOCK_BELOW_BPS) continue;
    const item = ITEM_BY_ID.get(itemId);
    if (!item) continue;
    const recipe = RECIPES[itemId];
    if (recipe) buyMaterials(world, shop, recipe, target - have);
    const canCraft = recipe && Object.entries(recipe).every(([m, n]) => (shop.stock[m] ?? 0) >= n);
    const unitCost = (item.basePrice * BigInt(canCraft ? CRAFT_COST_BPS : WHOLESALE_BPS)) / BigInt(BPS);
    let want = target - have;
    if (recipe && canCraft) {
      for (const [m, n] of Object.entries(recipe)) want = Math.min(want, Math.floor((shop.stock[m] ?? 0) / n));
    }
    const delivery = wageFor(shop, JOBS.delivery.baseWage);
    const affordable = unitCost > 0n ? Number((shop.wallet - delivery) / unitCost) : want;
    const units = Math.max(0, Math.min(want, affordable));
    if (units === 0) {
      okay = false;
      continue;
    }
    const cost = unitCost * BigInt(units);
    shop.wallet -= cost;
    shop.costsToday += cost;
    world.flows.wholesale += cost;
    shop.stock[itemId] = have + units;
    if (recipe && canCraft) for (const [m, n] of Object.entries(recipe)) shop.stock[m] = (shop.stock[m] ?? 0) - n * units;
    // Someone has to carry the goods in: one delivery per batch of units.
    for (let n = 0; n < Math.ceil(units / UNITS_PER_DELIVERY); n++) if (!postJob(world, shop, "delivery")) okay = false;
  }
  return okay;
}

/** Shoppers from outside town: the main way new money enters the economy. */
function visitors(world: World, shop: Shop): void {
  let tries = Math.floor(VISITOR_TRIES_PER_SHOP_BPS / BPS) + (chance(world.rng, VISITOR_TRIES_PER_SHOP_BPS % BPS) ? 1 : 0);
  const items = Object.keys(shop.targets).filter((i) => ITEM_BY_ID.get(i)?.category !== "Material");
  while (tries-- > 0) {
    const itemId = pick(world.rng, items);
    if (!itemId || sellableStock(shop, itemId) <= 0) continue;
    const item = ITEM_BY_ID.get(itemId);
    if (!item) continue;
    const demand = seasonDemandBps(world.season, itemId);
    if (!chance(world.rng, Math.min(BPS, Math.round(demand * 0.6)))) continue;
    const price = quoteSell(world, shop, itemId).price;
    if (price * BigInt(BPS) > item.basePrice * BigInt(VISITOR_MAX_PRICE_BPS)) continue;
    sellOne(shop, itemId, price);
    world.flows.visitors += price;
  }
}

/** One hour in the life of a shop. */
export function shopTick(world: World, shop: Shop, out: { events: GameEvent[] }): void {
  rollSalesWindows(shop);
  const rentPaid = payRent(world, shop);
  if (!shop.open) return;

  const restocked = restock(world, shop);
  // Busy shops (and keepers who chose to hire) post helper jobs.
  const openHelpers = world.jobs.filter((j) => j.shopId === shop.id && j.kind === "helper").length;
  const wanted = Math.round(busyness(shop) * JOBS_PER_BUSY_SHOP) + shop.hires;
  for (let n = openHelpers; n < wanted; n++) if (!postJob(world, shop, "helper")) break;
  const helpersOk = true; // missing helpers is not a sign of trouble
  visitors(world, shop);
  refreshPrices(world, shop);

  // In trouble: missed rent, could not restock, or not even one day's rent in hand.
  const reserve = shop.wallet >= dailyRent(shop);
  shop.troubleTicks = rentPaid && restocked && helpersOk && reserve ? 0 : shop.troubleTicks + 1;
  if (shop.troubleTicks >= BANKRUPT_AFTER_TICKS) closeShop(world, shop, out);
}

export function closeShop(world: World, shop: Shop, out: { events: GameEvent[] }): void {
  shop.open = false;
  shop.closedAtTick = world.tick;
  shop.troubleTicks = 0;
  // Unclaimed jobs are cancelled and their wages come back.
  world.jobs = world.jobs.filter((j) => {
    if (j.shopId !== shop.id) return true;
    shop.wallet += j.wage;
    return false;
  });
  const event: GameEvent = { tick: world.tick, kind: "shop_closed", shopId: shop.id, text: `${shop.name} ran out of money and closed.` };
  world.events.push(event);
  out.events.push(event);
}

/** Put coins into a shop for a share of future profit. Reopens it if closed. */
export function invest(world: World, shop: Shop, investorId: string, amount: Bits, out: { events: GameEvent[] }): void {
  shop.wallet += amount;
  record(world, { from: playerParty(investorId), to: shopParty(shop.id), amount, kind: "invest", memo: "investment" });
  shop.investors[investorId] = (shop.investors[investorId] ?? 0n) + amount;
  const investor = world.players[investorId]?.name ?? "Someone";
  const invested: GameEvent = { tick: world.tick, kind: "invested", shopId: shop.id, text: `${investor} invested in ${shop.name}.` };
  world.events.push(invested);
  out.events.push(invested);
  if (!shop.open) {
    shop.open = true;
    shop.closedAtTick = null;
    shop.troubleTicks = 0;
    shop.margin = "normal";
    refreshPrices(world, shop);
    const reopened: GameEvent = { tick: world.tick, kind: "shop_reopened", shopId: shop.id, text: `${shop.name} is open again!` };
    world.events.push(reopened);
    out.events.push(reopened);
  }
}

/** Shopkeeper strategy for the day. A mind can replace this; it must pick from the same options. */
export type ShopStrategy = {
  margin: Margin;
  hire: number;
  hoard: string | null;
  reason: string;
  verified?: boolean | null;
  signature?: string | null;
  proof?: Record<string, unknown> | null;
};

export function heuristicShopStrategy(world: World, shop: Shop): ShopStrategy {
  const dayCosts = SHOP_RENT_PER_DAY * 2n;
  if (shop.wallet < dayCosts) return { margin: "high", hire: 0, hoard: null, reason: "Money is tight, so prices go up and nobody new gets hired." };
  const rentDays = shop.wallet / (SHOP_RENT_PER_DAY * BigInt(Math.max(1, Math.round(shop.size))));
  if (rentDays > BigInt(RICH_SHOP_RENT_DAYS)) {
    const hire = Math.min(MAX_HIRES, 2 + Number(rentDays / BigInt(RICH_SHOP_RENT_DAYS * 4)));
    return { margin: "low", hire, hoard: null, reason: `Business is good. I'll cut prices and hire ${hire} helpers.` };
  }
  if (shop.personality === "generous") return { margin: "low", hire: 1, hoard: null, reason: "I like happy customers. Low prices today!" };
  const items = Object.keys(shop.targets);
  if (shop.personality === "greedy" && chance(world.rng, 2_500)) {
    const hoard = pick(world.rng, items) ?? null;
    if (hoard) return { margin: "high", hire: 0, hoard, reason: `I'll hold back some ${ITEM_BY_ID.get(hoard)?.title.toLowerCase()} and see what people pay.` };
  }
  const busy = busyness(shop);
  return busy > 0.5
    ? { margin: "high", hire: 1, hoard: null, reason: "So many customers! I'll raise prices a bit and hire help." }
    : { margin: "normal", hire: 0, hoard: null, reason: "A normal day. Fair prices." };
}

/** Once a day: update normal sales, share profit with investors, choose tomorrow's strategy. */
export function shopDay(world: World, shop: Shop, strategy: ShopStrategy, out: { decisions: Decision[]; events: GameEvent[] }, source: string): void {
  for (const [itemId, window] of Object.entries(shop.salesWindow)) {
    const today = window.reduce((a, b) => a + b, 0);
    const prev = shop.avgSales[itemId] ?? today;
    shop.avgSales[itemId] = Math.max(1, prev + (today - prev) * AVG_SMOOTHING);
  }
  const profit = shop.incomeToday - shop.costsToday;
  const totalShares = Object.values(shop.investors).reduce((a, b) => a + b, 0n);
  if (shop.open && profit > 0n && totalShares > 0n) {
    const share = (profit * BigInt(INVESTOR_PROFIT_SHARE_BPS)) / BigInt(BPS);
    for (const [investorId, shares] of Object.entries(shop.investors)) {
      const cut = (share * shares) / totalShares;
      const player = world.players[investorId];
      if (!player || cut <= 0n || cut > shop.wallet) continue;
      shop.wallet -= cut;
      player.wallet += cut;
      record(world, { from: shopParty(shop.id), to: playerParty(investorId), amount: cut, kind: "profit", memo: "investor share" });
    }
  }
  shop.incomeToday = 0n;
  shop.costsToday = 0n;
  if (!shop.open) return;

  const hoardChanged = strategy.hoard && strategy.hoard !== shop.hoard;
  shop.margin = strategy.margin;
  shop.hires = strategy.hire;
  shop.hoard = strategy.hoard;
  if (hoardChanged) {
    const e: GameEvent = { tick: world.tick, kind: "hoard", shopId: shop.id, text: `${shop.keeper} is holding back ${ITEM_BY_ID.get(strategy.hoard ?? "")?.title.toLowerCase()}.` };
    world.events.push(e);
    out.events.push(e);
  }
  out.decisions.push({
    tick: world.tick,
    actorId: shop.id,
    actorKind: "shop",
    action: `margin:${strategy.margin}`,
    target: strategy.hoard,
    reason: strategy.reason,
    say: null,
    cost: 0n,
    source: strategy.proof ? "near-ai" : source,
    verified: strategy.verified ?? null,
    signature: strategy.signature ?? null,
    proof: strategy.proof ?? null,
  });
  refreshPrices(world, shop);
}
