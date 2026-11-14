/**
 * Top ups from any chain: quote with a deposit address, track the swap, and
 * credit the player's coins once the NEAR has arrived and gone into the town.
 */
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players, topups } from "@/db/schema";
import { YOCTO_PER_BIT } from "@/economy/config";
import { serverEnv } from "@/lib/env";
import { decryptKey } from "@/near/keys";
import { ids } from "@/near/town-chain";
import { ensureRegistered, unwrapIntoTown, wnearBalance } from "@/near/wnear";
import { liveTokens, parseUnits, type TopUpCoin } from "@/topup/assets";
import { quote, swapStatus } from "@/topup/oneclick";
import { noChanges, withWorld } from "./world-store";

export const topUpsLive = () => serverEnv().NEAR_NETWORK === "mainnet";

export type Preview = { send: string; receiveNear: string; coins: string; usd: string | null; seconds: number };

function coinsFor(yocto: bigint): bigint {
  return yocto / YOCTO_PER_BIT; // bits
}

async function findCoin(coinId: string): Promise<TopUpCoin | null> {
  return (await liveTokens()).coins.find((c) => c.id === coinId) ?? null;
}

/** Coins a player can top up with, live from 1Click. */
export async function topUpCoins(): Promise<TopUpCoin[]> {
  return (await liveTokens().catch(() => null))?.coins ?? [];
}

export async function previewTopUp(coinId: string, amount: string): Promise<Preview | string> {
  if (!topUpsLive()) return "Top ups open when the town is on NEAR mainnet.";
  const coin = await findCoin(coinId).catch(() => null);
  if (!coin) return "Pick a coin.";
  const units = parseUnits(amount, coin.decimals);
  if (!units || units <= 0n) return "Enter an amount.";
  const gameId = serverEnv().NEAR_GAME_ACCOUNT;
  if (!gameId) return "Top ups are unavailable right now.";
  try {
    // Priced as if delivered to the game's own (registered) account; nothing moves on a dry quote.
    await ensureRegistered(gameId);
    const q = await quote({ originAsset: coin.assetId, amount: units, recipient: gameId, dry: true });
    return {
      send: `${q.quote.amountInFormatted} ${coin.label}`,
      receiveNear: q.quote.amountOutFormatted,
      coins: coinsFor(BigInt(q.quote.minAmountOut)).toString(),
      usd: q.quote.amountInUsd ?? null,
      seconds: q.quote.timeEstimate,
    };
  } catch (err) {
    return err instanceof Error && /amount/i.test(err.message) ? "That amount is too small to swap." : "Prices are unavailable right now. Try again soon.";
  }
}

export type TopUpView = {
  id: number;
  coin: string;
  send: string;
  depositAddress: string;
  depositMemo: string | null;
  status: string;
  coins: string | null;
  deadline: string | null;
  seconds: number | null;
};

function view(row: typeof topups.$inferSelect, coin?: TopUpCoin | null): TopUpView {
  const q = row.quote as { quote?: { amountInFormatted?: string; deadline?: string; timeEstimate?: number } };
  return {
    id: row.id,
    coin: coin?.label ?? row.coinId,
    send: `${q.quote?.amountInFormatted ?? "?"} ${coin?.symbol ?? ""}`.trim(),
    depositAddress: row.depositAddress,
    depositMemo: row.depositMemo,
    status: row.status,
    coins: row.creditedBits?.toString() ?? null,
    deadline: q.quote?.deadline ?? null,
    seconds: q.quote?.timeEstimate ?? null,
  };
}

export async function startTopUp(db: Db, playerId: string, coinId: string, amount: string): Promise<TopUpView | string> {
  if (!topUpsLive()) return "Top ups from other chains open when the town is on NEAR mainnet.";
  const coin = await findCoin(coinId);
  const units = coin ? parseUnits(amount, coin.decimals) : null;
  if (!coin || !units || units <= 0n) return "Enter an amount.";
  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  if (!p?.nearAccountId) return "Your town account is still being made. Try again in a moment.";
  await ensureRegistered(p.nearAccountId);
  const q = await quote({ originAsset: coin.assetId, amount: units, recipient: p.nearAccountId, dry: false });
  if (!q.quote.depositAddress) return "No deposit address came back. Try again.";
  const [row] = await db
    .insert(topups)
    .values({ playerId, coinId, amountIn: units.toString(), depositAddress: q.quote.depositAddress, depositMemo: q.quote.depositMemo ?? null, quote: q })
    .returning();
  return view(row!, coin);
}

export async function listTopUps(db: Db, playerId: string): Promise<TopUpView[]> {
  const rows = await db.select().from(topups).where(eq(topups.playerId, playerId)).orderBy(desc(topups.id)).limit(5);
  const coins = await topUpCoins();
  return rows.map((r) => view(r, coins.find((c) => c.id === r.coinId)));
}

/** Check 1Click; when the swap succeeded, move the NEAR into the town and credit coins. */
export async function refreshTopUp(db: Db, playerId: string, id: number): Promise<TopUpView | null> {
  const [row] = await db.select().from(topups).where(and(eq(topups.id, id), eq(topups.playerId, playerId)));
  if (!row) return null;
  const coin = (await topUpCoins()).find((c) => c.id === row.coinId);
  if (row.creditedBits !== null || ["REFUNDED", "FAILED", "CREDITING"].includes(row.status)) return view(row, coin);
  const st = await swapStatus(row.depositAddress).catch(() => null);
  if (!st) return view(row, coin);
  await db.update(topups).set({ status: st.status, updatedAt: new Date() }).where(eq(topups.id, id));
  if (st.status !== "SUCCESS") return view({ ...row, status: st.status }, coin);

  const [p] = await db.select().from(players).where(eq(players.id, playerId));
  const secret = serverEnv().KEYS_SECRET;
  if (!p?.nearAccountId || !p.nearKeyEnc || !secret) return view({ ...row, status: st.status }, coin);
  // Exactly one request may move the money: claim the row atomically.
  const claimed = await db
    .update(topups)
    .set({ status: "CREDITING", updatedAt: new Date() })
    .where(and(eq(topups.id, id), isNull(topups.creditedBits), ne(topups.status, "CREDITING")))
    .returning({ id: topups.id });
  if (!claimed.length) return view({ ...row, status: "CREDITING" }, coin);
  // Only what actually arrived, rounded down to whole bits; any dust stays as NEAR in their account.
  const arrived = await wnearBalance(p.nearAccountId);
  const delivered = BigInt(st.swapDetails?.amountOut ?? "0");
  const usable = ((delivered > 0n && delivered < arrived ? delivered : arrived) / YOCTO_PER_BIT) * YOCTO_PER_BIT;
  if (usable <= 0n) {
    await db.update(topups).set({ status: st.status }).where(eq(topups.id, id));
    return view({ ...row, status: st.status }, coin);
  }
  const tx = await unwrapIntoTown({ accountId: p.nearAccountId, fullKey: decryptKey(p.nearKeyEnc, secret), amount: usable, town: ids().town });
  const bits = coinsFor(usable);
  await db.update(topups).set({ status: "SUCCESS", creditedBits: bits, creditTx: tx, updatedAt: new Date() }).where(eq(topups.id, id));
  // Already on chain; the game only mirrors it (no chain op).
  await withWorld(db, async (world) => {
    const player = world.players[playerId];
    if (player) player.wallet += bits;
    return { result: null, changes: noChanges() };
  });
  return view({ ...row, status: st.status, creditedBits: bits, creditTx: tx }, coin);
}
