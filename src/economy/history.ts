/** Daily snapshots for charts and the World screen. */
import { ITEMS } from "./config";
import { moneyState } from "./state";
import type { DaySnapshot, World } from "./types";

const MAX_DAYS = 120;

function percentile(sorted: bigint[], p: number): bigint {
  if (sorted.length === 0) return 0n;
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0n;
}

export function snapshot(world: World, day: number): DaySnapshot {
  const prices: Record<string, bigint> = {};
  for (const item of ITEMS) {
    const quotes = Object.values(world.shops)
      .filter((s) => s.open && s.prices[item.id])
      .map((s) => s.prices[item.id]?.price ?? 0n);
    if (quotes.length) prices[item.id] = quotes.reduce((a, b) => a + b, 0n) / BigInt(quotes.length);
  }
  const states: Record<string, number> = {};
  const wallets: bigint[] = [];
  for (const s of Object.values(world.slimes)) {
    const st = moneyState(s);
    states[st] = (states[st] ?? 0) + 1;
    wallets.push(s.wallet);
  }
  wallets.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return {
    day,
    prices,
    shopWallets: Object.fromEntries(Object.values(world.shops).map((s) => [s.id, s.wallet])),
    shopsOpen: Object.values(world.shops).filter((s) => s.open).length,
    states,
    wealth: { p10: percentile(wallets, 0.1), p50: percentile(wallets, 0.5), p90: percentile(wallets, 0.9), total: wallets.reduce((a, b) => a + b, 0n) },
    treasury: world.treasury,
  };
}

export function recordDay(world: World, day: number): DaySnapshot {
  const snap = snapshot(world, day);
  world.history.push(snap);
  if (world.history.length > MAX_DAYS) world.history.splice(0, world.history.length - MAX_DAYS);
  return snap;
}
