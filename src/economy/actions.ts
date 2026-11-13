/**
 * What a real player can do. Each action checks ownership, changes the town,
 * writes the money journal (so the chain mirrors it) and logs a decision.
 */
import { ITEM_BY_ID, OWNER_PLAY_JOY, STARTER_WALLET, THINK_COST, type Bits, type ItemCategory, type JobKind } from "./config";
import { jobsFor, takeJob } from "./jobs";
import { playerParty, record, shopParty, slimeParty } from "./journal";
import { cheapestSellers, sellOne } from "./market";
import { remember } from "./memory";
import { formatCoins } from "./money";
import { applyItem } from "./slimes";
import type { Decision, Player, Rules, Slime, SlimeColour, World } from "./types";
import { hatchSlime } from "./world";

export type ActionResult = { ok: true; message: string; decision?: Decision } | { ok: false; message: string };

/** Starter coins a new player gets to look after their slime. */
export const PLAYER_STARTER_WALLET: Bits = STARTER_WALLET / 2n;

function decision(world: World, slime: Slime, d: Pick<Decision, "action" | "target" | "reason" | "cost" | "say">): Decision {
  return { tick: world.tick, actorId: slime.id, actorKind: "slime", source: "owner", verified: null, signature: null, ...d };
}

/** Add a signed-in player to the town (once). */
export function ensurePlayer(world: World, id: string, name: string): Player {
  const existing = world.players[id];
  if (existing) return existing;
  const player: Player = { id, name, wallet: PLAYER_STARTER_WALLET, care: "real" };
  world.players[id] = player;
  return player;
}

export function slimesOf(world: World, playerId: string): Slime[] {
  return Object.values(world.slimes).filter((s) => s.ownerId === playerId);
}

/** Owned by this player? Every action checks this first. */
export function ownedSlime(world: World, playerId: string, slimeId: string): Slime | null {
  const slime = world.slimes[slimeId];
  return slime && slime.ownerId === playerId ? slime : null;
}

export function hatch(world: World, playerId: string, name: string, colour?: SlimeColour): Slime {
  const slime = hatchSlime(world, { ownerId: playerId, name, colour });
  slime.lastCareTick = world.tick;
  return slime;
}

/** Pat and play: happiness up, and the slime is not lonely any more. */
export function play(world: World, playerId: string, slimeId: string): ActionResult {
  const slime = ownedSlime(world, playerId, slimeId);
  if (!slime) return { ok: false, message: "That's not your slime." };
  slime.joy = Math.min(100, slime.joy + OWNER_PLAY_JOY);
  slime.lastCareTick = world.tick;
  remember(slime, "My owner played with me!");
  return { ok: true, message: `${slime.name} loved that!` };
}

/** The player buys an item with their own coins and gives it to their slime. */
export function giveItem(world: World, playerId: string, slimeId: string, itemId: string): ActionResult {
  const slime = ownedSlime(world, playerId, slimeId);
  const player = world.players[playerId];
  const item = ITEM_BY_ID.get(itemId);
  if (!slime || !player) return { ok: false, message: "That's not your slime." };
  if (!item || item.category === "Material") return { ok: false, message: "You can't give that." };
  const offer = cheapestSellers(world, itemId)[0];
  if (!offer) return { ok: false, message: `${item.title} is sold out everywhere.` };
  if (offer.price > player.wallet) return { ok: false, message: "Not enough coins. Top up first!" };
  player.wallet -= offer.price;
  record(world, { from: playerParty(playerId), to: shopParty(offer.shop.id), amount: offer.price, kind: "gift", memo: `${itemId} for ${slimeId}` });
  sellOne(offer.shop, itemId, offer.price);
  applyItem(slime, item);
  slime.lastCareTick = world.tick;
  if (slime.asleep && slime.energy >= 40) slime.asleep = false;
  remember(slime, `My owner gave me ${item.title.toLowerCase()}!`);
  return {
    ok: true,
    message: `${slime.name} got ${item.title.toLowerCase()} for ${formatCoins(offer.price)} coins.`,
    decision: decision(world, slime, { action: "gift", target: itemId, reason: `My owner bought it at ${offer.shop.name}.`, cost: offer.price, say: "Yum, thank you!" }),
  };
}

/** Feed: the cheapest filling food. */
export function feed(world: World, playerId: string, slimeId: string): ActionResult {
  const foods = ["berries", "jelly", "ice", "cake"].filter((id) => cheapestSellers(world, id)[0]);
  const best = foods.sort((a, b) => {
    const pa = cheapestSellers(world, a)[0]!.price;
    const pb = cheapestSellers(world, b)[0]!.price;
    return pa < pb ? -1 : 1;
  })[0];
  if (!best) return { ok: false, message: "The food shops are all out. Try again soon!" };
  return giveItem(world, playerId, slimeId, best);
}

/** Move coins from the player to their slime. */
export function topUpSlime(world: World, playerId: string, slimeId: string, amount: Bits): ActionResult {
  const slime = ownedSlime(world, playerId, slimeId);
  const player = world.players[playerId];
  if (!slime || !player) return { ok: false, message: "That's not your slime." };
  if (amount <= 0n || amount > player.wallet) return { ok: false, message: "Not enough coins." };
  player.wallet -= amount;
  slime.wallet += amount;
  record(world, { from: playerParty(playerId), to: slimeParty(slimeId), amount, kind: "gift", memo: "top up" });
  if (slime.asleep) slime.asleep = false;
  remember(slime, `My owner gave me ${formatCoins(amount)} coins.`);
  return { ok: true, message: `${slime.name} now has ${formatCoins(slime.wallet)} coins.` };
}

/** Send the slime to the best job it may take right now. */
export function sendToJob(world: World, playerId: string, slimeId: string): ActionResult {
  const slime = ownedSlime(world, playerId, slimeId);
  if (!slime) return { ok: false, message: "That's not your slime." };
  if (slime.asleep) return { ok: false, message: `${slime.name} is asleep. Feed it first.` };
  if (slime.job) return { ok: false, message: `${slime.name} is already working.` };
  const job = jobsFor(world, slime)[0];
  if (!job) return { ok: false, message: slime.energy < 20 ? `${slime.name} is too tired. Feed it first.` : "No jobs right now. Check back soon!" };
  takeJob(world, slime, job);
  slime.lastCareTick = world.tick;
  return {
    ok: true,
    message: `${slime.name} went off to a ${job.kind} job for ${formatCoins(job.wage)} coins.`,
    decision: decision(world, slime, { action: "job", target: job.kind, reason: "My owner sent me to work.", cost: 0n, say: "Off to work!" }),
  };
}

const CATEGORIES: ItemCategory[] = ["Food", "Toy", "Training", "Hat", "Material"];
const JOB_KINDS: JobKind[] = ["delivery", "helper", "guard", "race", "puzzle"];

export function setRules(world: World, playerId: string, slimeId: string, rules: Rules): ActionResult {
  const slime = ownedSlime(world, playerId, slimeId);
  if (!slime) return { ok: false, message: "That's not your slime." };
  if (rules.dailyLimit < 0n || rules.savingsTarget < 0n) return { ok: false, message: "Limits can't be negative." };
  slime.rules = {
    dailyLimit: rules.dailyLimit,
    savingsTarget: rules.savingsTarget,
    allowed: CATEGORIES.filter((c) => rules.allowed.includes(c)),
    allowedJobs: JOB_KINDS.filter((j) => rules.allowedJobs.includes(j)),
  };
  return { ok: true, message: `${slime.name}'s rules are saved.` };
}

/**
 * The owner talked with their slime. A real reply was a thought, which the
 * slime pays for. Player words are not stored in memory (they could carry
 * instructions into later prompts); only that a chat happened.
 */
export function recordChat(world: World, playerId: string, slimeId: string, reply: { say: string; thought: boolean }): Decision | null {
  const slime = ownedSlime(world, playerId, slimeId);
  if (!slime) return null;
  let cost: Bits = 0n;
  if (reply.thought && slime.wallet >= THINK_COST) {
    slime.wallet -= THINK_COST;
    world.flows.thinking += THINK_COST;
    cost = THINK_COST;
    record(world, { from: slimeParty(slime.id), to: { kind: "minds" }, amount: THINK_COST, kind: "think", memo: "a chat" });
  }
  slime.lastCareTick = world.tick;
  slime.joy = Math.min(100, slime.joy + 8);
  remember(slime, "My owner talked with me.");
  return decision(world, slime, { action: "talk", target: null, reason: reply.say, cost, say: reply.say });
}
