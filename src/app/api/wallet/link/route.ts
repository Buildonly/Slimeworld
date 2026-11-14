import { z } from "zod";
import { db } from "@/db/client";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { linkWallet } from "@/server/wallet-link";

const schema = z.object({
  accountId: z.string().regex(/^[a-z0-9._-]{2,64}$/),
  publicKey: z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,50}$/),
  signature: z.string().min(20).max(200),
  nonce: z.string().min(20).max(100),
});

/** Prove a NEAR wallet is yours by its signature, and link it. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `wallet-link:${playerId}`, 10, 600))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "That wallet answer didn't look right.");
  const r = await linkWallet(db(), playerId, body);
  if (!r.ok) return fail(409, r.message);
  return Response.json({ ok: true, wallet: r.accountId });
}
