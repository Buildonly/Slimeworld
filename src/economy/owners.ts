/**
 * Simulated players for the headless sim and the fast forward town: they
 * play with, feed and top up their slimes, feed sleeping strangers, and
 * invest in closed shops. Real players ("real") do this themselves.
 */
import {
  BPS,
  HUNGRY_BELOW,
  INVEST_CHANCE_PER_DAY_BPS,
  MIN_REOPEN_INVESTMENT,
  OWNER_CARE_EVERY,
  OWNER_PLAY_JOY,
  OWNER_TOP_UP_AMOUNT,
  OWNER_TOP_UP_BELOW,
  TICKS_PER_DAY,
  coins,
} from "./config";
import { cheapestSellers, sellOne } from "./market";
import { remember } from "./memory";
import { chance, pick } from "./rng";
import { invest } from "./shops";
import { applyItem } from "./slimes";
import { ITEM_BY_ID } from "./config";
import type { GameEvent, Player, Slime, World } from "./types";

/** Weekly pocket money simulated owners top up from outside (real money in). */
const WEEKLY_TOP_UP = { devoted: coins(400), casual: coins(150), absent: 0n, real: 0n } as const;

/** The owner buys the cheapest food and gives it to a slime. */
export function feedSlime(world: World, player: Player, slime: Slime): boolean {
  const offer = cheapestSellers(world, "berries")[0] ?? cheapestSellers(world, "jelly")[0];
  const item = offer ? ITEM_BY_ID.get(Object.keys(offer.shop.targets).find((i) => i === "berries" || i === "jelly") ?? "") : undefined;
  if (!offer || !item || offer.price > player.wallet) return false;
  player.wallet -= offer.price;
  sellOne(offer.shop, item.id, offer.price);
  applyItem(slime, item);
  return true;
}

export function ownersTick(world: World, out: { events: GameEvent[] }): void {
  const day = world.tick % TICKS_PER_DAY === 0;
  for (const player of Object.values(world.players)) {
    if (player.care === "real") continue;
    if (day && world.tick % (TICKS_PER_DAY * 7) === 0) {
      player.wallet += WEEKLY_TOP_UP[player.care];
      world.flows.topUps += WEEKLY_TOP_UP[player.care];
    }
    const every = OWNER_CARE_EVERY[player.care];
    if (every > 0 && world.tick % every === 0) {
      for (const slime of Object.values(world.slimes)) {
        if (slime.ownerId !== player.id) continue;
        slime.joy = Math.min(100, slime.joy + OWNER_PLAY_JOY);
        slime.lastCareTick = world.tick;
        if (slime.energy < HUNGRY_BELOW) feedSlime(world, player, slime);
        if (slime.wallet < OWNER_TOP_UP_BELOW && player.wallet >= OWNER_TOP_UP_AMOUNT) {
          player.wallet -= OWNER_TOP_UP_AMOUNT;
          slime.wallet += OWNER_TOP_UP_AMOUNT;
        }
      }
      // Kind players feed a sleeping stranger now and then.
      const sleeper = pick(world.rng, Object.values(world.slimes).filter((s) => s.asleep && s.ownerId !== player.id));
      if (sleeper && player.care === "devoted" && chance(world.rng, 3_000)) {
        for (let i = 0; i < 2; i++) feedSlime(world, player, sleeper);
        sleeper.lastCareTick = world.tick;
        if (!sleeper.friends.includes(player.id)) sleeper.friends.push(player.id);
        remember(sleeper, `${player.name} fed me while I was asleep. A friend!`);
        const e: GameEvent = { tick: world.tick, kind: "fed_by_friend", slimeId: sleeper.id, text: `${player.name} fed ${sleeper.name}, who was asleep.` };
        world.events.push(e);
        out.events.push(e);
      }
    }
    // Investors keep the town alive: closed shops get rescued after a while.
    if (day && player.wallet >= MIN_REOPEN_INVESTMENT * 2n && chance(world.rng, INVEST_CHANCE_PER_DAY_BPS)) {
      const closed = Object.values(world.shops).filter((s) => !s.open && s.closedAtTick !== null && world.tick - s.closedAtTick >= TICKS_PER_DAY);
      const shop = pick(world.rng, closed);
      if (shop) {
        const amount = (player.wallet * BigInt(BPS / 2)) / BigInt(BPS);
        player.wallet -= amount;
        invest(world, shop, player.id, amount, out);
      }
    }
  }
}
