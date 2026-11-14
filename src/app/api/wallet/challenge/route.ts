import { db } from "@/db/client";
import { fail } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { newChallenge } from "@/server/wallet-link";

/** A one-time message for the player's wallet to sign. */
export async function POST() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `wallet-challenge:${playerId}`, 10, 600))) return fail(429, "Slow down a little!");
  return Response.json({ ok: true, ...(await newChallenge(db(), playerId)) });
}
