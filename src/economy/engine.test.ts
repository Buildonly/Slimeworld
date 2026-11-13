import { describe, expect, it } from "vitest";
import { coins, ITEMS, PRICE_MAX_BPS, PRICE_MIN_BPS, BPS, TICKS_PER_DAY } from "./config";
import { canSpend } from "./rules";
import { moneyState } from "./state";
import { runTick } from "./tick";
import type { World } from "./types";
import { createTown, emptyWorld, hatchSlime } from "./world";

/** Every coin in town, wherever it sits. */
function moneyInTown(w: World): bigint {
  let total = w.treasury;
  for (const s of Object.values(w.slimes)) total += s.wallet;
  for (const s of Object.values(w.shops)) total += s.wallet;
  for (const p of Object.values(w.players)) total += p.wallet;
  for (const j of w.jobs) total += j.wage;
  for (const c of w.contests) total += c.pot;
  for (const s of Object.values(w.slimes)) if (s.job) total += s.job.wage;
  return total;
}

async function run(w: World, ticks: number) {
  for (let i = 0; i < ticks; i++) await runTick(w);
}

describe("economy engine", () => {
  it("never creates or loses money: town total = start + money in - money out", async () => {
    const w = createTown(3, 60);
    const start = moneyInTown(w);
    await run(w, TICKS_PER_DAY * 10);
    const f = w.flows;
    const expected = start + f.visitors + f.guardPay + f.topUps - f.wholesale - f.rent - f.thinking;
    expect(moneyInTown(w)).toBe(expected);
  });

  it("is deterministic for a seed", async () => {
    const a = createTown(11, 40);
    const b = createTown(11, 40);
    await run(a, 72);
    await run(b, 72);
    expect(moneyInTown(a)).toBe(moneyInTown(b));
    expect(a.history).toEqual(b.history);
  });

  it("keeps every shop price within 0.5x to 3x base", async () => {
    const w = createTown(5, 80);
    for (let i = 0; i < TICKS_PER_DAY * 8; i++) {
      await runTick(w);
      for (const shop of Object.values(w.shops)) {
        for (const [itemId, point] of Object.entries(shop.prices)) {
          const base = ITEMS.find((it) => it.id === itemId)!.basePrice;
          expect(point.price).toBeGreaterThanOrEqual((base * BigInt(PRICE_MIN_BPS)) / BigInt(BPS));
          expect(point.price).toBeLessThanOrEqual((base * BigInt(PRICE_MAX_BPS)) / BigInt(BPS));
        }
      }
    }
  });

  it("logs every slime decision with a reason and cost", async () => {
    const w = createTown(9, 30);
    const out = await runTick(w);
    const more = await runTick(w);
    const decisions = [...out.decisions, ...more.decisions];
    expect(decisions.length).toBeGreaterThan(0);
    for (const d of decisions) {
      expect(d.reason.length).toBeGreaterThan(5);
      expect(typeof d.cost).toBe("bigint");
    }
  });

  it("lets a neglected slime go broke and fall asleep, and a fed slime wake up", async () => {
    const w = createTown(4, 50);
    const absent = Object.values(w.slimes).find((s) => s.ownerId && w.players[s.ownerId]?.care === "absent")!;
    let slept = false;
    for (let i = 0; i < TICKS_PER_DAY * 12 && !slept; i++) {
      await runTick(w);
      slept = absent.asleep;
    }
    expect(slept).toBe(true);
    expect(moneyState(absent)).toBe("asleep");
    absent.energy = 80; // someone fed it
    await runTick(w);
    expect(absent.asleep).toBe(false);
  });
});

describe("owner rules", () => {
  const w = emptyWorld(1);
  const slime = hatchSlime(w, { ownerId: "p1" });

  it("allows food within the limit and above savings", () => {
    slime.wallet = coins(100);
    slime.rules.savingsTarget = coins(20);
    expect(canSpend(slime, "Food", coins(10)).ok).toBe(true);
  });

  it("blocks categories the owner did not allow", () => {
    slime.rules.allowed = ["Food"];
    expect(canSpend(slime, "Hat", coins(10))).toEqual({ ok: false, why: "My owner said no" });
  });

  it("blocks spending over the daily limit", () => {
    slime.spentToday = slime.rules.dailyLimit;
    expect(canSpend(slime, "Food", coins(1)).ok).toBe(false);
    slime.spentToday = 0n;
  });

  it("keeps savings, except for food when starving", () => {
    slime.wallet = coins(25);
    slime.energy = 50;
    expect(canSpend(slime, "Food", coins(10)).ok).toBe(false);
    slime.energy = 10;
    expect(canSpend(slime, "Food", coins(10)).ok).toBe(true);
  });
});
