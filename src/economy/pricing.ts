/**
 * Shop pricing. The whole formula, in one place:
 *
 *   price = base x stockFactor x demandFactor x personality x margin x season
 *
 * then clamped so no price ever leaves 0.5x to 3x of base. All factors are
 * basis points (10_000 = 1.0x) and money is bigint, so there are no floats
 * near money. Every quote carries a short reason the game shows in a tooltip.
 */
import {
  BPS,
  BUY_MARGIN_BPS,
  DEMAND_FACTOR_MAX_BPS,
  DEMAND_FACTOR_MIN_BPS,
  DEMAND_SENSITIVITY_BPS,
  MARGIN_FACTOR_BPS,
  PERSONALITY_FACTOR_BPS,
  PRICE_MAX_BPS,
  PRICE_MIN_BPS,
  STOCK_FACTOR_MAX_BPS,
  STOCK_FACTOR_MIN_BPS,
  type Bits,
  type Margin,
  type ShopPersonality,
} from "./config";
import { formatCoins } from "./money";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const applyBps = (amount: Bits, bps: number): Bits => (amount * BigInt(Math.round(bps))) / BigInt(BPS);

export type PriceInput = {
  itemTitle: string;
  base: Bits;
  /** Units the shop will sell right now (stock minus anything it is hoarding). */
  stock: number;
  targetStock: number;
  salesLast24h: number;
  /** The shop's normal daily sales of this item. */
  avgSales: number;
  personality: ShopPersonality;
  margin: Margin;
  /** Season event multiplier in basis points. */
  seasonBps: number;
};

export type PriceQuote = {
  price: Bits;
  stockBps: number;
  demandBps: number;
  /** One short sentence in the shopkeeper's voice. */
  reason: string;
};

/** Low stock pushes the price up, a full shelf pushes it down. */
export function stockFactorBps(stock: number, targetStock: number): number {
  return clamp(Math.round((targetStock * BPS) / Math.max(stock, 1)), STOCK_FACTOR_MIN_BPS, STOCK_FACTOR_MAX_BPS);
}

/** Selling more than usual pushes the price up, a slow day pushes it down. */
export function demandFactorBps(salesLast24h: number, avgSales: number): number {
  const avg = Math.max(avgSales, 1);
  const raw = BPS + Math.round(((salesLast24h - avg) / avg) * DEMAND_SENSITIVITY_BPS);
  return clamp(raw, DEMAND_FACTOR_MIN_BPS, DEMAND_FACTOR_MAX_BPS);
}

/** The price a shop asks for one unit. */
export function sellPrice(input: PriceInput): PriceQuote {
  const stockBps = stockFactorBps(input.stock, input.targetStock);
  const demandBps = demandFactorBps(input.salesLast24h, input.avgSales);
  let price = input.base;
  for (const bps of [stockBps, demandBps, PERSONALITY_FACTOR_BPS[input.personality], MARGIN_FACTOR_BPS[input.margin], input.seasonBps]) {
    price = applyBps(price, bps);
  }
  // Hard limits: never below 0.5x or above 3x base.
  const min = applyBps(input.base, PRICE_MIN_BPS);
  const max = applyBps(input.base, PRICE_MAX_BPS);
  if (price < min) price = min;
  if (price > max) price = max;
  return { price, stockBps, demandBps, reason: explain(input, price) };
}

/**
 * What a shop pays a player or slime for one unit: its own price x buyMargin,
 * and less again when the shelf is already full.
 */
export function buyPrice(input: PriceInput): PriceQuote {
  const quote = sellPrice(input);
  const fullness = input.stock > input.targetStock ? clamp(Math.round((input.targetStock * BPS) / input.stock), 2_500, BPS) : BPS;
  const price = applyBps(applyBps(quote.price, BUY_MARGIN_BPS), fullness);
  return { ...quote, price: price > 0n ? price : 1n };
}

function explain(input: PriceInput, price: Bits): string {
  const item = input.itemTitle;
  const move = `${item} ${formatCoins(input.base)} → ${formatCoins(price)}`;
  const stockPart =
    input.stock < input.targetStock / 2
      ? `only ${input.stock} left`
      : input.stock > input.targetStock * 1.5
        ? `I have ${input.stock} and want ${input.targetStock}`
        : `${input.stock} in stock`;
  const sold = `sold ${input.salesLast24h} today`;
  const season = input.seasonBps > BPS ? ", and everyone wants it this season" : input.seasonBps < BPS ? ", and it's plentiful this season" : "";
  return `${move}: ${stockPart}, ${sold}${season}.`;
}
