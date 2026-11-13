/**
 * Jobs (delivery, shop helper, guard) and contests (races, puzzles).
 */
import {
  BPS,
  CONTEST_WINNER_SHARE_BPS,
  CONTESTS,
  DELIVERY_FIND_CHANCE_BPS,
  GUARD_JOBS_PER_TICK_PER_100_SLIMES_BPS,
  JOB_BASE_SUCCESS_BPS,
  JOB_JOY_SUCCESS_BPS_PER_POINT,
  JOB_SKILL_GAIN,
  JOB_SKILL_SUCCESS_BPS_PER_POINT,
  JOBS,
  TREASURY_FEE_BPS,
  type Bits,
} from "./config";
import { nextWorldId } from "./ids";
import { remember } from "./memory";
import { formatCoins } from "./money";
import { chance, nextFloat, pick, pickWeighted } from "./rng";
import type { Contest, GameEvent, Job, Slime, World } from "./types";

const JOB_EXPIRES_AFTER = 6;

export function skillFor(slime: Slime, skill: "speed" | "smarts" | "charm" | "size"): number {
  return skill === "size" ? Math.round(slime.size * 60) : slime.skills[skill];
}

/** Chance (bps) a slime does a job well. */
export function successChanceBps(slime: Slime, job: Job): number {
  const def = JOBS[job.kind as keyof typeof JOBS];
  const skill = def ? skillFor(slime, def.skill) : 30;
  const raw = JOB_BASE_SUCCESS_BPS + skill * JOB_SKILL_SUCCESS_BPS_PER_POINT + (slime.joy - 50) * JOB_JOY_SUCCESS_BPS_PER_POINT;
  return Math.round(Math.max(1_500, Math.min(9_500, raw)));
}

/** Jobs this slime could take right now, best expected pay first. */
export function jobsFor(world: World, slime: Slime): Job[] {
  return world.jobs
    .filter((j) => {
      const def = JOBS[j.kind as keyof typeof JOBS];
      return def && slime.rules.allowedJobs.includes(j.kind) && slime.energy >= def.energyCost;
    })
    .sort((a, b) => {
      const ea = a.wage * BigInt(successChanceBps(slime, a));
      const eb = b.wage * BigInt(successChanceBps(slime, b));
      return ea > eb ? -1 : ea < eb ? 1 : 0;
    });
}

export function takeJob(world: World, slime: Slime, job: Job): void {
  const def = JOBS[job.kind as keyof typeof JOBS];
  if (!def) return;
  world.jobs = world.jobs.filter((j) => j.id !== job.id);
  slime.energy = Math.max(0, slime.energy - def.energyCost);
  slime.job = {
    jobId: job.id,
    kind: job.kind,
    shopId: job.shopId,
    wage: job.wage,
    untilTick: world.tick + def.ticks,
    success: chance(world.rng, successChanceBps(slime, job)),
  };
}

/** Finish a job: pay on success, otherwise the wage goes back to the shop. */
export function finishJob(world: World, slime: Slime): void {
  const job = slime.job;
  if (!job || world.tick < job.untilTick) return;
  slime.job = null;
  const shop = job.shopId ? world.shops[job.shopId] : null;
  const def = JOBS[job.kind as keyof typeof JOBS];
  const where = shop ? ` for ${shop.keeper}` : "";
  if (job.success) {
    slime.wallet += job.wage;
    slime.earnedToday += job.wage;
    if (def && def.skill !== "size") slime.skills[def.skill] = Math.min(100, slime.skills[def.skill] + JOB_SKILL_GAIN);
    remember(slime, `I did a ${def?.title.toLowerCase() ?? "job"}${where} and earned ${formatCoins(job.wage)} coins.`);
    if (job.kind === "delivery" && chance(world.rng, DELIVERY_FIND_CHANCE_BPS)) {
      const found = pick(world.rng, ["iron", "wood"]) ?? "wood";
      slime.items[found] = (slime.items[found] ?? 0) + 1 + Math.floor(nextFloat(world.rng) * 3);
    }
  } else {
    if (shop) shop.wallet += job.wage;
    else world.flows.guardPay -= job.wage; // the outside client keeps their money
    remember(slime, `I messed up a ${def?.title.toLowerCase() ?? "job"}${where}. No pay.`);
  }
}

/** Players outside town pay slimes to guard their storage. New money for the town. */
export function postGuardJobs(world: World): void {
  const slimes = Object.keys(world.slimes).length;
  let bps = Math.round((GUARD_JOBS_PER_TICK_PER_100_SLIMES_BPS * slimes) / 100);
  while (bps > 0) {
    if (chance(world.rng, Math.min(BPS, bps))) {
      world.jobs.push({ id: nextWorldId(world, "g"), kind: "guard", shopId: null, wage: JOBS.guard.baseWage, postedTick: world.tick });
      world.flows.guardPay += JOBS.guard.baseWage;
    }
    bps -= BPS;
  }
}

/** Unclaimed jobs expire; shop wages go back to the shop. */
export function expireJobs(world: World): void {
  world.jobs = world.jobs.filter((j) => {
    if (world.tick - j.postedTick < JOB_EXPIRES_AFTER) return true;
    const shop = j.shopId ? world.shops[j.shopId] : null;
    if (shop) shop.wallet += j.wage;
    else world.flows.guardPay -= j.wage; // never paid out
    return false;
  });
}

/** Open a new race or puzzle contest on schedule. */
export function openContests(world: World): void {
  for (const kind of ["race", "puzzle"] as const) {
    const def = CONTESTS[kind];
    if (world.tick % def.everyTicks !== 0) continue;
    world.contests.push({ id: nextWorldId(world, kind[0] ?? "c"), kind, entry: def.entry, entrants: [], pot: 0n, settlesAt: world.tick + 2 });
  }
}

export function enterContest(slime: Slime, contest: Contest): void {
  slime.wallet -= contest.entry;
  slime.spentToday += contest.entry;
  slime.energy = Math.max(0, slime.energy - CONTESTS[contest.kind].energyCost);
  contest.entrants.push(slime.id);
  contest.pot += contest.entry;
}

/** Pick winners by skill and luck; the treasury keeps its fee. */
export function settleContests(world: World, out: { events: GameEvent[] }): void {
  const due = world.contests.filter((c) => c.settlesAt <= world.tick);
  world.contests = world.contests.filter((c) => c.settlesAt > world.tick);
  for (const c of due) {
    if (c.pot === 0n) continue;
    const fee = (c.pot * BigInt(TREASURY_FEE_BPS)) / BigInt(BPS);
    world.treasury += fee;
    const prize = c.pot - fee;
    const field = c.entrants.map((id) => world.slimes[id]).filter((s): s is Slime => Boolean(s));
    const skill = CONTESTS[c.kind].skill;
    const weights = field.map((s) => (s.skills[skill] + 10) ** 2 * (s.joy + 50));
    const first = pickWeighted(world.rng, weights);
    const winner = field[first];
    if (!winner) {
      world.treasury += prize;
      continue;
    }
    const second = field.length > 1 ? pickWeighted(world.rng, weights.map((w, i) => (i === first ? 0 : w))) : -1;
    const runnerUp = field[second];
    const top = runnerUp ? (prize * BigInt(CONTEST_WINNER_SHARE_BPS)) / BigInt(BPS) : prize;
    pay(winner, top, `I won the ${CONTESTS[c.kind].title.toLowerCase()}! ${formatCoins(top)} coins!`);
    if (runnerUp) pay(runnerUp, prize - top, `I came second in the ${CONTESTS[c.kind].title.toLowerCase()}.`);
    for (const s of field) if (s !== winner && s !== runnerUp) remember(s, `I lost the ${CONTESTS[c.kind].title.toLowerCase()} to ${winner.name}.`);
    if (field.length >= 3) {
      const e: GameEvent = { tick: world.tick, kind: "contest", slimeId: winner.id, text: `${winner.name} won the ${CONTESTS[c.kind].title.toLowerCase()} (${field.length} slimes).` };
      world.events.push(e);
      out.events.push(e);
    }
  }
}

function pay(slime: Slime, amount: Bits, line: string): void {
  slime.wallet += amount;
  slime.earnedToday += amount;
  remember(slime, line);
}
