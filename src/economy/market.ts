/**
 * Buying from and selling to shops. Prices always come from pricing.ts.
 */
import { BPS, ITEM_BY_ID, TICKS_PER_DAY, type Bits } from "./config";
import { buyPrice, sellPrice, type PriceInput, type PriceQuote } from "./pricing";
import { seasonPriceBps } from "./seasons";
import type { Shop, World } from "./types";

/** Units a shop will actually sell (it may hold some back when hoarding). */
export function sellableStock(shop: Shop, itemId: string): number {
  const stock = shop.stock[itemId] ?? 0;
  if (shop.hoard !== itemId) return stock;
  const keep = Math.floor(((shop.targets[itemId] ?? 0) * 5_000) / BPS);
  return Math.max(0, stock - keep);
}

function sales24h(shop: Shop, itemId: string): number {
  return (shop.salesWindow[itemId] ?? []).reduce((a, b) => a + b, 0);
}

function priceInput(world: World, shop: Shop, itemId: string): PriceInput {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  return {
    itemTitle: item.title,
    base: item.basePrice,
    stock: sellableStock(shop, itemId),
    targetStock: shop.targets[itemId] ?? 1,
    salesLast24h: sales24h(shop, itemId),
    avgSales: shop.avgSales[itemId] ?? 1,
    personality: shop.personality,
    margin: shop.margin,
    seasonBps: seasonPriceBps(world.season, itemId),
  };
}

export function quoteSell(world: World, shop: Shop, itemId: string): PriceQuote {
  return sellPrice(priceInput(world, shop, itemId));
}

export function quoteBuy(world: World, shop: Shop, itemId: string): PriceQuote {
  return buyPrice(priceInput(world, shop, itemId));
}

/** Refresh every price on a shop's board. */
export function refreshPrices(world: World, shop: Shop): void {
  for (const itemId of Object.keys(shop.targets)) {
    const q = quoteSell(world, shop, itemId);
    shop.prices[itemId] = { price: q.price, reason: q.reason };
  }
}

function recordSale(shop: Shop, itemId: string, units: number): void {
  const window = (shop.salesWindow[itemId] ??= Array.from({ length: TICKS_PER_DAY }, () => 0));
  window[window.length - 1] = (window[window.length - 1] ?? 0) + units;
}

/** Shop sells one unit at its current price. Caller has already checked the buyer may pay. */
export function sellOne(shop: Shop, itemId: string, price: Bits): void {
  shop.stock[itemId] = (shop.stock[itemId] ?? 0) - 1;
  shop.wallet += price;
  shop.incomeToday += price;
  recordSale(shop, itemId, 1);
}

/** Shop buys `units` of a material. Returns what it paid. */
export function buyFromSeller(world: World, shop: Shop, itemId: string, units: number): Bits {
  const unit = quoteBuy(world, shop, itemId).price;
  const total = unit * BigInt(units);
  if (total > shop.wallet) return 0n;
  shop.wallet -= total;
  shop.costsToday += total;
  shop.stock[itemId] = (shop.stock[itemId] ?? 0) + units;
  return total;
}

/** Open shops selling this item with stock, cheapest first. */
export function cheapestSellers(world: World, itemId: string): { shop: Shop; price: Bits }[] {
  return Object.values(world.shops)
    .filter((s) => s.open && s.targets[itemId] !== undefined && sellableStock(s, itemId) > 0)
    .map((shop) => ({ shop, price: quoteSell(world, shop, itemId).price }))
    .sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0));
}

/** Open shops buying this item, best offer first. */
export function bestBuyers(world: World, itemId: string): { shop: Shop; price: Bits }[] {
  return Object.values(world.shops)
    .filter((s) => s.open && s.buys.includes(itemId))
    .map((shop) => ({ shop, price: quoteBuy(world, shop, itemId).price }))
    .filter((o) => o.price <= o.shop.wallet)
    .sort((a, b) => (a.price > b.price ? -1 : a.price < b.price ? 1 : 0));
}

/** Move each shop's sales window on by one tick. */
export function rollSalesWindows(shop: Shop): void {
  for (const window of Object.values(shop.salesWindow)) {
    window.shift();
    window.push(0);
  }
}
