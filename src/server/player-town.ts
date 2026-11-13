/**
 * Player-facing town operations: hatching and actions, each done on the
 * locked town, then handed to the chain worker.
 */
import { and, count, eq } from "drizzle-orm";
import { KeyPair } from "near-api-js";
import type { Db } from "@/db/client";
import { chainOps, players, slimeAccounts } from "@/db/schema";
import { ensurePlayer, feed, giveItem, hatch, PLAYER_STARTER_WALLET, play, sendToJob, setRules, slimesOf, topUpSlime, type ActionResult } from "@/economy/actions";
import { STARTER_WALLET, type Bits } from "@/economy/config";
import { invest } from "@/economy/shops";
import type { Rules, SlimeColour } from "@/economy/types";
import { serverEnv } from "@/lib/env";
import { gameAccount } from "@/near/client";
import { encryptKey } from "@/near/keys";
import { chainRules, toYocto } from "@/near/town-ops";
import { loadWorld, MAIN_WORLD, noChanges, withWorld } from "./world-store";

export const MAX_SLIMES_PER_PLAYER = 3;

export type HatchResult = { ok: true; slimeId: string } | { ok: false; message: string };

export async function hatchForPlayer(db: Db, playerId: string, name: string, colour?: SlimeColour): Promise<HatchResult> {
  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  const game = gameAccount();
  const secret = serverEnv().KEYS_SECRET;
  if (!player?.nearAccountId) return { ok: false, message: "Your town account is still being made. Try again in a moment." };
  if (!game || !secret) return { ok: false, message: "The town is not open yet." };
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(slimeAccounts).where(and(eq(slimeAccounts.playerId, playerId), eq(slimeAccounts.worldId, MAIN_WORLD)));
  if (n >= MAX_SLIMES_PER_PLAYER) return { ok: false, message: `You can raise up to ${MAX_SLIMES_PER_PLAYER} slimes.` };

  const result = await withWorld(db, async (world, tx) => {
    // Public name in town news: never the email.
    const p = ensurePlayer(world, playerId, `${name}'s keeper`);
    const slime = hatch(world, p.id, name, colour);
    const key = KeyPair.fromRandom("ed25519");
    await tx.insert(slimeAccounts).values({
      slimeId: slime.id,
      worldId: MAIN_WORLD,
      playerId,
      accountId: `s-${playerId.slice(0, 8)}-${slime.id}.${game.accountId}`,
      keyEnc: encryptKey(key.toString(), secret),
      nftTokenId: `${MAIN_WORLD}-${slime.id}`,
    });
    if (!player.chainReady) {
      await tx.insert(chainOps).values({ worldId: MAIN_WORLD, tick: world.tick, kind: "player_setup", payload: { type: "player_setup", playerId, starterYocto: toYocto(PLAYER_STARTER_WALLET) } });
    }
    await tx.insert(chainOps).values({
      worldId: MAIN_WORLD,
      tick: world.tick,
      kind: "hatch",
      payload: {
        type: "hatch",
        slimeId: slime.id,
        playerId,
        name: slime.name,
        traits: { colour: slime.colour, personality: slime.personality, size: slime.size, skills: slime.skills },
        rules: chainRules(slime.rules),
        starterYocto: toYocto(STARTER_WALLET),
      },
    });
    return { result: slime.id, changes: noChanges() };
  });
  return result ? { ok: true, slimeId: result } : { ok: false, message: "The town is busy. Try again." };
}

export type PlayerAction =
  | { action: "feed"; slimeId: string }
  | { action: "play"; slimeId: string }
  | { action: "give"; slimeId: string; itemId: string }
  | { action: "job"; slimeId: string }
  | { action: "topup"; slimeId: string; amount: Bits }
  | { action: "rules"; slimeId: string; rules: Rules };

export async function actForPlayer(db: Db, playerId: string, a: PlayerAction): Promise<ActionResult> {
  const result = await withWorld(db, async (world, tx) => {
    let r: ActionResult;
    switch (a.action) {
      case "feed":
        r = feed(world, playerId, a.slimeId);
        break;
      case "play":
        r = play(world, playerId, a.slimeId);
        break;
      case "give":
        r = giveItem(world, playerId, a.slimeId, a.itemId);
        break;
      case "job":
        r = sendToJob(world, playerId, a.slimeId);
        break;
      case "topup":
        r = topUpSlime(world, playerId, a.slimeId, a.amount);
        break;
      case "rules": {
        r = setRules(world, playerId, a.slimeId, a.rules);
        const slime = world.slimes[a.slimeId];
        const [acct] = await tx.select().from(slimeAccounts).where(and(eq(slimeAccounts.worldId, MAIN_WORLD), eq(slimeAccounts.slimeId, a.slimeId)));
        if (r.ok && slime && acct) {
          // The owner signs the new rules themselves (gasless): the contract only accepts them from the owner.
          await tx.insert(chainOps).values({
            worldId: MAIN_WORLD,
            tick: world.tick,
            kind: "meta",
            payload: { type: "meta", playerId, method: "set_rules", args: { slime_id: acct.accountId, rules: chainRules(slime.rules) } },
          });
        }
        break;
      }
    }
    const changes = noChanges();
    changes.moves = world.journal.splice(0);
    if (r.ok && r.decision) changes.decisions.push(r.decision);
    return { result: r, changes };
  });
  return result ?? { ok: false, message: "The town is busy. Try again." };
}

export async function investForPlayer(db: Db, playerId: string, shopId: string, amount: Bits): Promise<ActionResult> {
  const result = await withWorld<ActionResult>(db, async (world) => {
    const shop = world.shops[shopId];
    const player = world.players[playerId];
    if (!shop) return { result: { ok: false as const, message: "No such shop." }, changes: noChanges() };
    if (!player) return { result: { ok: false as const, message: "Hatch a slime first!" }, changes: noChanges() };
    if (amount > player.wallet) return { result: { ok: false as const, message: "Not enough coins." }, changes: noChanges() };
    const changes = noChanges();
    player.wallet -= amount;
    const wasClosed = !shop.open;
    invest(world, shop, playerId, amount, changes);
    changes.moves = world.journal.splice(0);
    return { result: { ok: true as const, message: wasClosed ? `${shop.name} is open again, thanks to you!` : `You now own a share of ${shop.name}.` }, changes };
  });
  return result ?? { ok: false, message: "The town is busy. Try again." };
}

/** The player's slimes with their chain status. */
export async function playerSlimes(db: Db, playerId: string) {
  const rows = await db.select().from(slimeAccounts).where(and(eq(slimeAccounts.playerId, playerId), eq(slimeAccounts.worldId, MAIN_WORLD)));
  const world = await loadWorld(db);
  const byId = new Map(rows.map((r) => [r.slimeId, r]));
  return {
    player: world.players[playerId] ?? null,
    slimes: slimesOf(world, playerId).map((s) => ({ slime: s, chain: byId.get(s.id) ?? null })),
    world,
  };
}
