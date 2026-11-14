/**
 * Playing together: cheer another player's slime, or send it a gift of
 * coins from your own purse. Gifts move real coins, so they go in the money
 * journal (the town contract mirrors them); cheers are just love.
 */
import { CHEER_JOY, GIFT_MAX, type Bits } from "./config";
import { playerParty, record, slimeParty } from "./journal";
import { remember } from "./memory";
import { formatCoins } from "./money";
import type { GameEvent, World } from "./types";

export type SocialResult = { ok: true; message: string; event: GameEvent } | { ok: false; message: string };

function news(world: World, e: Omit<GameEvent, "tick">): GameEvent {
  const event = { tick: world.tick, ...e };
  world.events.push(event);
  return event;
}

export function cheer(world: World, playerId: string, slimeId: string): SocialResult {
  const slime = world.slimes[slimeId];
  const player = world.players[playerId];
  if (!slime || !player) return { ok: false, message: "That slime isn't around." };
  if (slime.ownerId === playerId) return { ok: false, message: "Cheer someone else's slime!" };
  slime.cheers += 1;
  slime.joy = Math.min(100, slime.joy + CHEER_JOY);
  remember(slime, `${player.name} cheered for me!`);
  return { ok: true, message: `You cheered for ${slime.name}!`, event: news(world, { kind: "cheered", slimeId, text: `${player.name} cheered for ${slime.name}.` }) };
}

export function giftTo(world: World, playerId: string, slimeId: string, amount: Bits): SocialResult {
  const slime = world.slimes[slimeId];
  const player = world.players[playerId];
  if (!slime || !player) return { ok: false, message: "That slime isn't around." };
  if (slime.ownerId === playerId) return { ok: false, message: "Use Coins to give to your own slime." };
  // Only slimes other players raise: their coins live on chain like yours, so the gift is mirrored exactly.
  const owner = slime.ownerId ? world.players[slime.ownerId] : undefined;
  if (owner?.care !== "real") return { ok: false, message: "You can send gifts to slimes other players raise." };
  if (amount <= 0n || amount > GIFT_MAX) return { ok: false, message: `Gifts can be up to ${formatCoins(GIFT_MAX)} coins.` };
  if (amount > player.wallet) return { ok: false, message: "Not enough coins in your purse." };
  player.wallet -= amount;
  slime.wallet += amount;
  if (slime.asleep) slime.asleep = false;
  record(world, { from: playerParty(playerId), to: slimeParty(slimeId), amount, kind: "gift", memo: "gift from a friend" });
  remember(slime, `${player.name} gave me ${formatCoins(amount)} coins!`);
  return { ok: true, message: `You gave ${slime.name} ${formatCoins(amount)} coins!`, event: news(world, { kind: "gift", slimeId, text: `${player.name} gave ${slime.name} ${formatCoins(amount)} coins.` }) };
}
