/**
 * One hour in a slime's life. Cheap rules run first (eat, sell finds, work
 * when below savings); only real choices go to its mind, and each thought
 * costs the slime money. See docs/ECONOMY.md, "Slime spending".
 */
import {
  BPS,
  BROKE_BELOW,
  TREASURY_FEE_BPS,
  ENERGY_DECAY_PER_TICK,
  HUNGRY_BELOW,
  ITEM_BY_ID,
  ITEMS,
  JOY_DECAY_PER_TICK,
  LONELY_AFTER_TICKS,
  STARVING_BELOW,
  THINK_COST,
  THINK_EVERY_TICKS,
  TOWN_SLIME_JOY_FLOOR,
  TRAINING_GAIN,
  type Bits,
  type ItemDef,
} from "./config";
import { enterContest, finishJob, jobsFor, takeJob } from "./jobs";
import { bestBuyers, cheapestSellers, sellOne } from "./market";
import { remember } from "./memory";
import { record, shopParty, slimeParty } from "./journal";
import type { Mind, MindChoice, MindOption } from "./mind";
import { formatCoins } from "./money";
import { canSpend, recordSpend } from "./rules";
import type { Decision, GameEvent, Slime, World } from "./types";

type Out = { decisions: Decision[]; events: GameEvent[] };

function decide(world: World, slime: Slime, out: Out, d: Omit<Decision, "tick" | "actorId" | "actorKind">): void {
  out.decisions.push({ tick: world.tick, actorId: slime.id, actorKind: "slime", ...d });
}

/** Owned slimes nobody has looked after for a while. */
export function isLonely(world: World, slime: Slime): boolean {
  return slime.ownerId !== null && world.tick - slime.lastCareTick > LONELY_AFTER_TICKS;
}

/** Use an item straight away: food gives energy, toys joy, training skill. */
export function applyItem(slime: Slime, item: ItemDef): void {
  if (item.energy) slime.energy = Math.min(100, slime.energy + item.energy);
  if (item.joy) slime.joy = Math.min(100, slime.joy + item.joy);
  if (item.trains) slime.skills[item.trains] = Math.min(100, slime.skills[item.trains] + TRAINING_GAIN);
}

/** Buy one unit from the cheapest open shop the rules allow. Returns the price, or null. */
export function buyItem(world: World, slime: Slime, itemId: string): { price: Bits; shopName: string; reason: string } | null {
  const item = ITEM_BY_ID.get(itemId);
  if (!item) return null;
  for (const { shop, price } of cheapestSellers(world, itemId)) {
    if (!canSpend(slime, item.category, price).ok) return null;
    record(world, {
      from: slimeParty(slime.id),
      to: shopParty(shop.id),
      amount: price,
      kind: "spend",
      category: item.category,
      emergency: item.category === "Food" && slime.energy < STARVING_BELOW,
      memo: itemId,
    });
    recordSpend(slime, price);
    sellOne(shop, itemId, price);
    applyItem(slime, item);
    return { price, shopName: shop.name, reason: shop.prices[itemId]?.reason ?? "" };
  }
  return null;
}

/** Best food for the money: most energy per coin among what it may buy now. */
function bestFood(world: World, slime: Slime): { item: ItemDef; price: Bits } | null {
  let best: { item: ItemDef; price: Bits; score: number } | null = null;
  for (const item of ITEMS) {
    if (item.category !== "Food" || !item.energy) continue;
    const offer = cheapestSellers(world, item.id)[0];
    if (!offer || !canSpend(slime, "Food", offer.price).ok) continue;
    const score = item.energy / Number(offer.price);
    if (!best || score > best.score) best = { item, price: offer.price, score };
  }
  return best;
}

function thinkEvery(wallet: Bits): number {
  for (const step of THINK_EVERY_TICKS) if (wallet >= step.walletAtLeast) return step.every;
  return Number.POSITIVE_INFINITY;
}

/** What the mind may choose from, already filtered by the owner's rules. */
export function mindOptions(world: World, slime: Slime): MindOption[] {
  const options: MindOption[] = [{ action: "save", target: null, cost: 0n, label: "Save" }];
  const job = jobsFor(world, slime)[0];
  if (job) options.push({ action: "job", target: job.id, cost: 0n, value: job.wage, label: `A ${job.kind} job for ${formatCoins(job.wage)} coins` });
  for (const contest of world.contests) {
    if (contest.entrants.includes(slime.id) || contest.settlesAt <= world.tick + 0) continue;
    if (!slime.rules.allowedJobs.includes(contest.kind) || slime.energy < 30) continue;
    if (!canSpend(slime, "Race", contest.entry).ok) continue;
    options.push({ action: contest.kind, target: contest.id, cost: contest.entry, label: contest.kind === "race" ? "The race" : "The puzzle contest" });
  }
  for (const item of ITEMS) {
    const action = item.category === "Training" ? "train" : item.category === "Toy" ? "toy" : item.category === "Hat" ? "hat" : null;
    if (!action) continue;
    const offer = cheapestSellers(world, item.id)[0];
    if (!offer || !canSpend(slime, item.category, offer.price).ok) continue;
    options.push({ action, target: item.id, cost: offer.price, label: item.title });
  }
  return options;
}

/** Carry out the mind's choice. Anything not on the option list is ignored. */
function act(world: World, slime: Slime, choice: MindChoice, options: MindOption[]): { done: boolean; cost: Bits } {
  const option = options.find((o) => o.action === choice.action && o.target === choice.target);
  if (!option || option.action === "save") return { done: Boolean(option), cost: 0n };
  if (option.action === "job") {
    const job = world.jobs.find((j) => j.id === option.target);
    if (!job) return { done: false, cost: 0n };
    takeJob(world, slime, job);
    return { done: true, cost: 0n };
  }
  if (option.action === "race" || option.action === "puzzle") {
    const contest = world.contests.find((c) => c.id === option.target);
    if (!contest) return { done: false, cost: 0n };
    enterContest(world, slime, contest);
    return { done: true, cost: contest.entry };
  }
  const bought = option.target ? buyItem(world, slime, option.target) : null;
  if (bought) remember(slime, `I bought ${ITEM_BY_ID.get(option.target ?? "")?.title.toLowerCase()} at ${bought.shopName}.`);
  return { done: Boolean(bought), cost: bought?.price ?? 0n };
}

export async function slimeTick(world: World, slime: Slime, mind: Mind, out: Out): Promise<void> {
  // Body and mood.
  if (!slime.asleep) slime.energy = Math.max(0, slime.energy - ENERGY_DECAY_PER_TICK);
  slime.joy = Math.max(slime.ownerId ? 0 : TOWN_SLIME_JOY_FLOOR, slime.joy - JOY_DECAY_PER_TICK);
  finishJob(world, slime);

  // Asleep until fed or topped up by anyone.
  if (slime.asleep) {
    if (slime.energy >= HUNGRY_BELOW || slime.wallet >= BROKE_BELOW) {
      slime.asleep = false;
      remember(slime, "I woke up! Someone looked after me.");
      const e: GameEvent = { tick: world.tick, kind: "woke", slimeId: slime.id, text: `${slime.name} woke up.` };
      world.events.push(e);
      out.events.push(e);
    } else return;
  }
  if (slime.job) return;

  // Rule 1: eat when hungry.
  if (slime.energy < HUNGRY_BELOW && slime.rules.allowed.includes("Food")) {
    const food = bestFood(world, slime);
    if (food) {
      const bought = buyItem(world, slime, food.item.id);
      if (bought) {
        remember(slime, `I ate ${food.item.title.toLowerCase()} from ${bought.shopName}.`);
        decide(world, slime, out, {
          action: "buy",
          target: food.item.id,
          reason: `Cheapest energy I could find. ${bought.reason}`,
          say: slime.energy < STARVING_BELOW + 20 ? "Finally, food!" : null,
          cost: bought.price,
          source: "rule",
          verified: null,
          signature: null,
        });
      }
    }
  }

  // Can't eat, can't think: fall asleep.
  // Broke, hungry, no food it can pay for and no work it will do: fall asleep.
  const stuck =
    slime.wallet < BROKE_BELOW && slime.energy < HUNGRY_BELOW && !bestFood(world, slime) && (isLonely(world, slime) || !jobsFor(world, slime)[0]);
  if (slime.energy <= 0 || stuck) {
    slime.asleep = true;
    remember(slime, "I ran out of everything and fell asleep.");
    const e: GameEvent = { tick: world.tick, kind: "asleep", slimeId: slime.id, text: `${slime.name} fell asleep. Anyone can feed it.` };
    world.events.push(e);
    out.events.push(e);
    return;
  }

  // Sell anything found on deliveries.
  for (const [itemId, count] of Object.entries(slime.items)) {
    if (count <= 0 || ITEM_BY_ID.get(itemId)?.category !== "Material") continue;
    const buyer = bestBuyers(world, itemId)[0];
    if (!buyer) continue;
    const units = Math.min(count, Math.max(1, Number(buyer.shop.wallet / (buyer.price * 4n))));
    const paid = buyer.price * BigInt(units);
    if (paid > buyer.shop.wallet) continue;
    buyer.shop.wallet -= paid;
    buyer.shop.costsToday += paid;
    buyer.shop.stock[itemId] = (buyer.shop.stock[itemId] ?? 0) + units;
    slime.items[itemId] = count - units;
    // The treasury takes its fee on market sales, as the town contract does.
    const fee = (paid * BigInt(TREASURY_FEE_BPS)) / BigInt(BPS);
    world.treasury += fee;
    record(world, { from: shopParty(buyer.shop.id), to: slimeParty(slime.id), amount: paid, kind: "sale", memo: `${units} ${itemId}` });
    slime.wallet += paid - fee;
    slime.earnedToday += paid - fee;
    decide(world, slime, out, {
      action: "sell",
      target: itemId,
      reason: `${buyer.shop.keeper} paid the most: ${formatCoins(buyer.price)} each for ${units}.`,
      say: null,
      cost: -paid,
      source: "rule",
      verified: null,
      signature: null,
    });
  }

  // Lonely slimes stop working and comfort-buy treats, as far as their rules allow.
  if (isLonely(world, slime)) {
    const treat = ["cake", "ball", "jelly"].find((id) => {
      const item = ITEM_BY_ID.get(id);
      const offer = cheapestSellers(world, id)[0];
      return item && offer && canSpend(slime, item.category, offer.price).ok;
    });
    const bought = treat ? buyItem(world, slime, treat) : null;
    if (treat && bought) {
      remember(slime, `I felt lonely, so I bought ${ITEM_BY_ID.get(treat)?.title.toLowerCase()}.`);
      decide(world, slime, out, {
        action: "buy",
        target: treat,
        reason: "Nobody has played with me in ages. A treat will cheer me up.",
        say: "I miss you...",
        cost: bought.price,
        source: "rule",
        verified: null,
        signature: null,
      });
    }
    return;
  }

  // Rule 2: below the savings target, take the best job.
  if (slime.wallet < slime.rules.savingsTarget) {
    const job = jobsFor(world, slime)[0];
    if (job) {
      takeJob(world, slime, job);
      decide(world, slime, out, {
        action: "job",
        target: job.kind,
        reason: `I'm below my savings target, and this ${job.kind} job pays ${formatCoins(job.wage)}.`,
        say: null,
        cost: 0n,
        source: "rule",
        verified: null,
        signature: null,
      });
      return;
    }
  }

  // Rule 3: a real choice. Thinking costs money; poorer slimes think less often.
  if (world.tick - slime.lastThinkTick < thinkEvery(slime.wallet) || slime.wallet < THINK_COST) return;
  const options = mindOptions(world, slime);
  if (options.length <= 1) return;
  slime.lastThinkTick = world.tick;
  slime.wallet -= THINK_COST;
  record(world, { from: slimeParty(slime.id), to: { kind: "minds" }, amount: THINK_COST, kind: "think", memo: "one thought" });
  world.flows.thinking += THINK_COST;
  const choice = await mind.decide({ slime, options, tick: world.tick, world });
  const result = act(world, slime, choice, options);
  decide(world, slime, out, {
    action: result.done ? choice.action : "save",
    target: choice.target,
    reason: result.done ? choice.reason : "That choice wasn't possible, so I'll save.",
    say: choice.say,
    cost: THINK_COST + result.cost,
    source: choice.source ?? mind.name,
    verified: choice.verified,
    signature: choice.signature,
    proof: choice.proof ?? null,
  });
}
