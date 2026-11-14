import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { players, slimeAccounts } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { decryptKey } from "@/near/keys";
import { moveSlimeNft, nftOwner } from "@/near/nft-move";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { MAIN_WORLD } from "@/server/world-store";

const schema = z.object({ slimeId: z.string().regex(/^s[0-9a-z]{1,10}$/) });

/** Move one of your slime NFTs into your linked NEAR wallet. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `wallet-move:${playerId}`, 5, 600))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "Pick a slime.");
  const secret = serverEnv().KEYS_SECRET;
  const [p] = await db().select().from(players).where(eq(players.id, playerId));
  const [acct] = await db().select().from(slimeAccounts).where(and(eq(slimeAccounts.playerId, playerId), eq(slimeAccounts.worldId, MAIN_WORLD), eq(slimeAccounts.slimeId, body.slimeId)));
  if (!acct) return fail(404, "That's not your slime.");
  if (!p?.walletAccountId) return fail(409, "Connect your NEAR wallet first.");
  if (acct.status !== "ready" || !p.nearAccountId || !p.nearKeyEnc || !secret) return fail(409, "Your slime is still being set up. Try again in a minute.");
  const holder = await nftOwner(acct.nftTokenId).catch(() => null);
  if (holder === p.walletAccountId) return Response.json({ ok: true, message: "It's already in your wallet." });
  if (holder !== p.nearAccountId) return fail(409, "This slime's NFT isn't held by your game account any more.");
  try {
    const tx = await moveSlimeNft({ accountId: p.nearAccountId, fullKey: decryptKey(p.nearKeyEnc, secret), tokenId: acct.nftTokenId, to: p.walletAccountId });
    return Response.json({ ok: true, message: "Moved! Your slime NFT is in your wallet now.", tx });
  } catch (err) {
    console.error("NFT move failed:", err instanceof Error ? err.message : "unknown");
    return fail(502, "The move didn't go through. Try again soon.");
  }
}
