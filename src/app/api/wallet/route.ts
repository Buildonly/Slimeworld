import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { players, slimeAccounts } from "@/db/schema";
import { fail } from "@/server/http";
import { MAIN_WORLD } from "@/server/world-store";
import { currentPlayerId } from "@/server/session";
import { nftOwner } from "@/near/nft-move";

export const dynamic = "force-dynamic";

/** The player's linked wallet, and where each of their slime NFTs is. */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const [p] = await db().select().from(players).where(eq(players.id, playerId));
  const rows = await db().select().from(slimeAccounts).where(and(eq(slimeAccounts.playerId, playerId), eq(slimeAccounts.worldId, MAIN_WORLD)));
  const slimes = await Promise.all(
    rows.map(async (r) => ({ slimeId: r.slimeId, tokenId: r.nftTokenId, ready: r.status === "ready", holder: r.status === "ready" ? await nftOwner(r.nftTokenId).catch(() => null) : null })),
  );
  return Response.json({ ok: true, wallet: p?.walletAccountId ?? null, gameAccount: p?.nearAccountId ?? null, slimes });
}

/** Unlink the wallet (NFTs already moved stay in it). */
export async function DELETE() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  await db().update(players).set({ walletAccountId: null }).where(eq(players.id, playerId));
  return Response.json({ ok: true });
}
