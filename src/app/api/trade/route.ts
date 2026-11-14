import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { coins } from "@/economy/config";
import { processChainOps } from "@/server/chain-worker";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { marketDto, tradeForPlayer } from "@/server/trade";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** What's for sale, and what you could sell. */
export async function GET() {
  const world = await loadWorld(db());
  return Response.json({ ok: true, ...marketDto(world, await currentPlayerId()) });
}

const slimeId = z.string().regex(/^s[0-9a-z]{1,10}$/);
const listingId = z.string().regex(/^L[0-9a-z]{1,12}$/);
const amount = z.number().int().min(1).max(1_000_000).transform((n) => coins(n));
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("listItem"), slimeId, itemId: z.string().regex(/^[a-z]{2,16}$/), price: amount }),
  z.object({ action: z.literal("listShares"), shopId: z.string().regex(/^[a-z0-9-]{2,32}$/), shares: amount, price: amount }),
  z.object({ action: z.literal("cancel"), listingId }),
  z.object({ action: z.literal("buy"), listingId, toSlimeId: slimeId.nullable() }),
]);

/** List, take back or buy on the player market. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `trade:${playerId}`, 20, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "That trade didn't look right.");
  const r = await tradeForPlayer(db(), playerId, body);
  if (!r.ok) return fail(409, r.message);
  after(() => processChainOps(db()).catch(() => undefined));
  return Response.json({ ok: true, message: r.message });
}
