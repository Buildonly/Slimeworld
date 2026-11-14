import { describe, expect, it } from "vitest";
import { coins, type Margin, type ShopPersonality } from "./config";
import { buyPrice, demandFactorBps, sellPrice, stockFactorBps, type PriceInput } from "./pricing";

const base: PriceInput = {
  itemTitle: "Iron",
  base: coins(4),
  stock: 20,
  targetStock: 20,
  salesLast24h: 5,
  avgSales: 5,
  personality: "fair",
  margin: "normal",
  seasonBps: 10_000,
};

describe("pricing", () => {
  it("charges the base price when everything is normal", () => {
    expect(sellPrice(base).price).toBe(coins(4));
  });

  it("raises the price when stock is low and lowers it when the shelf is full", () => {
    expect(sellPrice({ ...base, stock: 5 }).price).toBeGreaterThan(coins(4));
    expect(sellPrice({ ...base, stock: 60 }).price).toBeLessThan(coins(4));
    expect(stockFactorBps(0, 20)).toBe(30_000);
    expect(stockFactorBps(1000, 20)).toBe(5_000);
  });

  it("follows demand within 0.7x to 2x", () => {
    expect(demandFactorBps(10, 5)).toBe(15_000);
    expect(demandFactorBps(0, 5)).toBe(7_000);
    expect(demandFactorBps(1000, 5)).toBe(20_000);
  });

  it("never leaves 0.5x to 3x of base, whatever happens", () => {
    const personalities: ShopPersonality[] = ["greedy", "fair", "generous"];
    const margins: Margin[] = ["low", "normal", "high"];
    for (const stock of [0, 1, 5, 20, 80, 10_000])
      for (const sales of [0, 3, 50, 5000])
        for (const personality of personalities)
          for (const margin of margins)
            for (const seasonBps of [8_000, 10_000, 14_000]) {
              const { price } = sellPrice({ ...base, stock, salesLast24h: sales, personality, margin, seasonBps });
              expect(price).toBeGreaterThanOrEqual(coins(2));
              expect(price).toBeLessThanOrEqual(coins(12));
            }
  });

  it("pays less than it charges, and less again when full", () => {
    const normal = buyPrice(base).price;
    expect(normal).toBeLessThan(sellPrice(base).price);
    expect(buyPrice({ ...base, stock: 60 }).price).toBeLessThan(normal);
  });

  it("explains itself", () => {
    expect(sellPrice({ ...base, stock: 60, salesLast24h: 3 }).reason).toBe("Iron 4 → 2: I have 60 and want 20, sold 3 today.");
  });
});
