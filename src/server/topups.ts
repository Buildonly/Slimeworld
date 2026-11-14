/**
 * Top ups from any chain, with no contract and no per-player account on
 * mainnet. 1Click swaps the deposit
 * into NEAR and delivers it straight to the game treasury's NEAR Intents
 * balance (TOPUP_TREASURY_ACCOUNT). Nothing needs registering or funding
 * first, so opening costs nothing. Once 1Click reports the exact amount
 * delivered for that deposit address, the player gets that many coins.
 * Coins are play money: they buy things in town and are never cashed out.
 */
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import type { Db } from "@/db/client";
import { topups } from "@/db/schema";
import { YOCTO_PER_BIT } from "@/economy/config";
import { playerParty, record } from "@/economy/journal";
import { serverEnv } from "@/lib/env";
import { liveTokens, parseUnits, type TopUpCoin } from "@/topup/assets";
import { quote, swapStatus } from "@/topup/oneclick";
import { noChanges, withWorld } from "./world-store";

/** The mainnet account whose NEAR Intents balance receives top ups. */
const treasury = () => serverEnv().TOPUP_TREASURY_ACCOUNT ?? null;
export const topUpsLive = () => Boolean(serverEnv().ONECLICK_URL && treasury());

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
  const to = treasury();
  if (!topUpsLive() || !to) return "Top ups are not open yet.";
  const coin = await findCoin(coinId).catch(() => null);
  if (!coin) return "Pick a coin.";
  const units = parseUnits(amount, coin.decimals);
  if (!units || units <= 0n) return "Enter an amount.";
  try {
    const q = await quote({ originAsset: coin.assetId, amount: units, recipient: to, dry: true });
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

export async function startTopUp(db: Db, playerId: string, coinId: string, amount: string, refundTo: string): Promise<TopUpView | string> {
  const to = treasury();
  if (!topUpsLive() || !to) return "Top ups are not open yet.";
  const coin = await findCoin(coinId);
  const units = coin ? parseUnits(amount, coin.decimals) : null;
  if (!coin || !units || units <= 0n) return "Enter an amount.";
  let q;
  try {
    q = await quote({ originAsset: coin.assetId, amount: units, recipient: to, refundTo, dry: false });
  } catch (err) {
    return err instanceof Error && /refund|address/i.test(err.message) ? `That doesn't look like a ${coin.chain.toUpperCase()} address. Check it and try again.` : "Top ups are unavailable right now. Try again soon.";
  }
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

/** Check 1Click; when the swap succeeded, credit exactly what was delivered, once. */
export async function refreshTopUp(db: Db, playerId: string, id: number): Promise<TopUpView | null> {
  const [row] = await db.select().from(topups).where(and(eq(topups.id, id), eq(topups.playerId, playerId)));
  if (!row) return null;
  const coin = (await topUpCoins()).find((c) => c.id === row.coinId);
  if (row.creditedBits !== null || ["REFUNDED", "FAILED", "CREDITING"].includes(row.status)) return view(row, coin);
  const st = await swapStatus(row.depositAddress).catch(() => null);
  if (!st) return view(row, coin);
  await db.update(topups).set({ status: st.status, updatedAt: new Date() }).where(eq(topups.id, id));
  const delivered = BigInt(st.swapDetails?.amountOut ?? "0");
  // Wait until 1Click states the delivered amount; never guess it.
  if (st.status !== "SUCCESS" || delivered <= 0n) return view({ ...row, status: st.status }, coin);

  // Exactly one request may credit: claim the row atomically.
  const claimed = await db
    .update(topups)
    .set({ status: "CREDITING", updatedAt: new Date() })
    .where(and(eq(topups.id, id), isNull(topups.creditedBits), ne(topups.status, "CREDITING")))
    .returning({ id: topups.id });
  if (!claimed.length) return view({ ...row, status: "CREDITING" }, coin);
  const bits = coinsFor(delivered);
  const proof = st.swapDetails?.nearTxHashes?.at(-1) ?? null;
  await withWorld(db, async (world) => {
    const changes = noChanges();
    const player = world.players[playerId];
    if (player) {
      player.wallet += bits;
      // The town ledger mirrors the purchase: the town pays the player's coins.
      record(world, { from: { kind: "town" }, to: playerParty(playerId), amount: bits, kind: "gift", memo: `top up ${id}` });
      changes.moves = world.journal.splice(0);
    }
    return { result: null, changes };
  });
  await db.update(topups).set({ status: "SUCCESS", creditedBits: bits, creditTx: proof, updatedAt: new Date() }).where(eq(topups.id, id));
  return view({ ...row, status: "SUCCESS", creditedBits: bits, creditTx: proof }, coin);
}
