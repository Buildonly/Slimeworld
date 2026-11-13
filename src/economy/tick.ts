/**
 * Advance the town one tick (one game hour). Order: season, contests and
 * jobs, shops, slimes, owners, then once a day the shopkeepers' strategy
 * and a history snapshot. The world is changed in place.
 */
import { BPS, GROWTH_PER_DAY, MAX_SIZE, SEASON_PRIZE_SHARE_BPS, TICKS_PER_DAY } from "./config";
import { recordDay } from "./history";
import { expireJobs, openContests, postGuardJobs, settleContests } from "./jobs";
import { remember } from "./memory";
import { heuristicMind, type Mind } from "./mind";
import { record, slimeParty } from "./journal";
import { formatCoins } from "./money";
import { ownersTick } from "./owners";
import { nextFloat } from "./rng";
import { season, seasonAt } from "./seasons";
import { heuristicShopStrategy, shopDay, shopTick, type ShopStrategy } from "./shops";
import { slimeTick } from "./slimes";
import type { Shop, TickOutput, World } from "./types";

export type ShopMind = { name: string; decide(world: World, shop: Shop): ShopStrategy | Promise<ShopStrategy> };

export type Minds = { slime: Mind; shop: ShopMind; simulateOwners: boolean };

export const heuristicShopMind: ShopMind = { name: "heuristic", decide: heuristicShopStrategy };
export const defaultMinds: Minds = { slime: heuristicMind, shop: heuristicShopMind, simulateOwners: true };

function changeSeason(world: World, out: TickOutput): void {
  const next = seasonAt(world.tick);
  if (next === world.season) return;
  world.season = next;
  // The treasury pays prizes to the top earners of the week.
  const prize = (world.treasury * BigInt(SEASON_PRIZE_SHARE_BPS)) / BigInt(BPS);
  const top = Object.values(world.slimes)
    .filter((s) => !s.asleep)
    .sort((a, b) => (b.earnedYesterday > a.earnedYesterday ? 1 : -1))
    .slice(0, 3);
  if (prize > 0n && top.length) {
    const each = prize / BigInt(top.length);
    for (const s of top) {
      s.wallet += each;
      record(world, { from: { kind: "town" }, to: slimeParty(s.id), amount: each, kind: "prize", memo: "season prize" });
      remember(s, `I won a ${formatCoins(each)} coin prize at the start of ${season(next).title.toLowerCase()}!`);
    }
    world.treasury -= each * BigInt(top.length);
    world.flows.prizes += each * BigInt(top.length);
  }
  const e = { tick: world.tick, kind: "season" as const, text: `${season(next).title} begins!` };
  world.events.push(e);
  out.events.push(e);
}

export async function runTick(world: World, minds: Minds = defaultMinds): Promise<TickOutput> {
  const out: TickOutput = { decisions: [], events: [], moves: [] };
  world.journal = [];
  world.tick += 1;
  changeSeason(world, out);
  settleContests(world, out);
  expireJobs(world);
  openContests(world);
  postGuardJobs(world);

  for (const shop of Object.values(world.shops)) shopTick(world, shop, out);

  // Slimes act in a shuffled order so nobody always gets first pick of jobs.
  const slimes = Object.values(world.slimes);
  for (let i = slimes.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(world.rng) * (i + 1));
    [slimes[i], slimes[j]] = [slimes[j]!, slimes[i]!];
  }
  for (const slime of slimes) await slimeTick(world, slime, minds.slime, out);

  if (minds.simulateOwners) ownersTick(world, out);

  if (world.tick % TICKS_PER_DAY === 0) {
    for (const shop of Object.values(world.shops)) shopDay(world, shop, await minds.shop.decide(world, shop), out, minds.shop.name);
    for (const s of Object.values(world.slimes)) {
      s.earnedYesterday = s.earnedToday;
      s.earnedToday = 0n;
      s.spentToday = 0n;
      if (!s.asleep && s.joy > 50 && s.energy > 40) s.size = Math.min(MAX_SIZE, s.size + GROWTH_PER_DAY);
    }
    recordDay(world, world.tick / TICKS_PER_DAY);
  }
  if (world.events.length > 500) world.events.splice(0, world.events.length - 500);
  out.moves = world.journal;
  world.journal = [];
  return out;
}
