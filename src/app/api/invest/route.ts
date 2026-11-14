import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { coins } from "@/economy/config";
import { fail, readJson } from "@/server/http";
import { processChainOps } from "@/server/chain-worker";
import { investForPlayer } from "@/server/player-town";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";

const schema = z.object({ shopId: z.string().regex(/^[a-z]{2,16}$/), amount: z.number().int().min(1).max(100_000).transform((n) => coins(n)) });

/** Invest coins in a shop for a share of its profit. Reopens a closed shop. Gasless. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `invest:${playerId}`, 10, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "How much?");
  const r = await investForPlayer(db(), playerId, body.shopId, body.amount);
  if (!r.ok) return fail(409, r.message);
  after(() => processChainOps(db()).catch(() => undefined));
  return Response.json({ ok: true, message: r.message });
}
