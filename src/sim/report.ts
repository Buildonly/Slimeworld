/** Turn a finished simulation into a readable text report and pass/fail checks. */
import { ITEMS, PRICE_MAX_BPS, PRICE_MIN_BPS, BPS } from "@/economy/config";
import { formatCoins } from "@/economy/money";
import { moneyState } from "@/economy/state";
import type { GameEvent, World } from "@/economy/types";

const BARS = "▁▂▃▄▅▆▇█";

/** Sparkline of values scaled between the item's 0.5x and 3x limits. */
function spark(values: number[], lo: number, hi: number): string {
  return values.map((v) => BARS[Math.max(0, Math.min(7, Math.round(((v - lo) / (hi - lo)) * 7)))] ?? " ").join("");
}

export type SimCheck = { name: string; ok: boolean; detail: string };

export function checks(world: World, allEvents: GameEvent[]): SimCheck[] {
  const out: SimCheck[] = [];
  let worst = "";
  let inRange = true;
  for (const item of ITEMS) {
    const min = (item.basePrice * BigInt(PRICE_MIN_BPS)) / BigInt(BPS);
    const max = (item.basePrice * BigInt(PRICE_MAX_BPS)) / BigInt(BPS);
    for (const day of world.history) {
      const p = day.prices[item.id];
      if (p === undefined) continue;
      if (p < min || p > max) {
        inRange = false;
        worst = `${item.title} hit ${formatCoins(p)} on day ${day.day}`;
      }
    }
  }
  out.push({ name: "Prices stay within 0.5x to 3x base", ok: inRange, detail: inRange ? "every item, every day" : worst });

  const closed = allEvents.filter((e) => e.kind === "shop_closed");
  const reopened = allEvents.filter((e) => e.kind === "shop_reopened" && closed.some((c) => c.shopId === e.shopId && c.tick < e.tick));
  out.push({
    name: "A shop closes and reopens",
    ok: reopened.length > 0,
    detail: `${closed.length} closings, ${reopened.length} reopenings (${[...new Set(closed.map((e) => e.shopId))].join(", ") || "none"})`,
  });
  return out;
}

export function report(world: World, allEvents: GameEvent[]): string {
  const lines: string[] = [];
  const days = world.history.length;
  lines.push(`Slimeworld simulation: ${days} days, ${Object.keys(world.slimes).length} slimes, ${Object.keys(world.shops).length} shops`);
  lines.push("");
  lines.push("Prices by day (bar height between 0.5x and 3x of base):");
  for (const item of ITEMS) {
    const values = world.history.map((d) => Number(d.prices[item.id] ?? 0n));
    const base = Number(item.basePrice);
    const seen = values.filter((v) => v > 0);
    if (!seen.length) continue;
    const lo = Math.min(...seen);
    const hi = Math.max(...seen);
    lines.push(
      `  ${item.title.padEnd(13)} ${spark(values, base * 0.5, base * 3)}  base ${formatCoins(item.basePrice).padStart(3)}  range ${formatCoins(BigInt(lo))}–${formatCoins(BigInt(hi))}`,
    );
  }
  lines.push("");
  lines.push("Shop wallets by day:");
  for (const shop of Object.values(world.shops)) {
    const values = world.history.map((d) => Number(d.shopWallets[shop.id] ?? 0n));
    const hi = Math.max(...values, 1);
    lines.push(`  ${shop.name.padEnd(17)} ${spark(values, 0, hi)}  now ${formatCoins(shop.wallet)}${shop.open ? "" : " (closed)"}`);
  }
  lines.push("");
  const last = world.history[world.history.length - 1];
  if (last) {
    lines.push(`Slime wallets now: p10 ${formatCoins(last.wealth.p10)}, median ${formatCoins(last.wealth.p50)}, p90 ${formatCoins(last.wealth.p90)} coins`);
    lines.push(`Slime moods now: ${Object.entries(last.states).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    lines.push(`Treasury: ${formatCoins(last.treasury)} coins`);
  }
  lines.push("By owner care (avg wallet, thriving, asleep):");
  for (const care of ["devoted", "casual", "absent", "town"] as const) {
    const group = Object.values(world.slimes).filter((s) => (s.ownerId ? world.players[s.ownerId]?.care : "town") === care);
    if (!group.length) continue;
    const avg = group.reduce((a, s) => a + s.wallet, 0n) / BigInt(group.length);
    const pct = (f: (s: (typeof group)[number]) => boolean) => `${Math.round((group.filter(f).length / group.length) * 100)}%`;
    lines.push(
      `  ${care.padEnd(8)} ${formatCoins(avg).padStart(7)} coins, thriving ${pct((s) => moneyState(s) === "thriving")}, asleep ${pct((s) => s.asleep)}, broke ${pct((s) => moneyState(s) === "broke")}`,
    );
  }
  const firstSleep = new Map<string, number>();
  for (const e of allEvents) if (e.kind === "asleep" && e.slimeId && !firstSleep.has(e.slimeId)) firstSleep.set(e.slimeId, e.tick);
  for (const care of ["devoted", "casual", "absent"] as const) {
    const group = Object.values(world.slimes).filter((s) => s.ownerId && world.players[s.ownerId]?.care === care);
    const slept = group.map((s) => firstSleep.get(s.id)).filter((t): t is number => t !== undefined).sort((a, b) => a - b);
    const median = slept[Math.floor(slept.length / 2)];
    lines.push(
      `  ${care.padEnd(8)} fell asleep at least once: ${Math.round((slept.length / Math.max(1, group.length)) * 100)}%` +
        (median !== undefined ? `, median after ${(median / 24).toFixed(1)} days` : ""),
    );
  }
  const f = world.flows;
  lines.push(
    `Money in: visitors ${formatCoins(f.visitors)}, guard pay ${formatCoins(f.guardPay)}, top ups ${formatCoins(f.topUps)}. ` +
      `Out: wholesale ${formatCoins(f.wholesale)}, rent ${formatCoins(f.rent)}, thinking ${formatCoins(f.thinking)}.`,
  );
  lines.push("");
  lines.push("Shop stories:");
  for (const e of allEvents.filter((e) => e.kind === "shop_closed" || e.kind === "shop_reopened" || e.kind === "invested").slice(0, 20)) {
    lines.push(`  day ${String(Math.floor(e.tick / 24)).padStart(2)}: ${e.text}`);
  }
  return lines.join("\n");
}
