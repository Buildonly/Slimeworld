import { z } from "zod";
import { db } from "@/db/client";
import { TOPUP_COINS } from "@/topup/assets";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { listTopUps, startTopUp, topUpsLive } from "@/server/topups";

export const dynamic = "force-dynamic";

/** Coins you can top up with, and your recent top ups. */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  return Response.json({
    live: topUpsLive(),
    coins: TOPUP_COINS.map((c) => ({ id: c.id, label: c.label, chain: c.chain, symbol: c.symbol })),
    recent: await listTopUps(db(), playerId),
  });
}

const schema = z.object({ coinId: z.string().max(20), amount: z.string().trim().regex(/^\d{1,9}(\.\d{1,18})?$/) });

/** Start a top up: get a deposit address on the coin's own chain. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `topup:${playerId}`, 6, 300))) return fail(429, "Too many top ups at once. Try again in a few minutes.");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "Enter an amount, like 5.");
  const r = await startTopUp(db(), playerId, body.coinId, body.amount).catch(() => "Top ups are unavailable right now. Try again soon.");
  if (typeof r === "string") return fail(409, r);
  return Response.json({ ok: true, topUp: r });
}
