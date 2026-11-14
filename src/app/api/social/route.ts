import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { coins, GIFTS_PER_DAY } from "@/economy/config";
import { fail, readJson } from "@/server/http";
import { processChainOps } from "@/server/chain-worker";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { socialForPlayer } from "@/server/social";

const slimeId = z.string().regex(/^s[0-9a-z]{1,10}$/);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cheer"), slimeId }),
  z.object({ action: z.literal("gift"), slimeId, amount: z.number().int().min(1).max(1_000_000).transform((n) => coins(n)) }),
]);
const DAY_SECONDS = 24 * 60 * 60;

/** Cheer or gift another player's slime. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `social:${playerId}`, 30, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "That didn't look right.");
  if (body.action === "cheer" && !(await allow(db(), `cheer:${playerId}:${body.slimeId}`, 1, DAY_SECONDS))) return fail(429, "You already cheered for this slime today!");
  if (body.action === "gift" && !(await allow(db(), `gift:${playerId}`, GIFTS_PER_DAY, DAY_SECONDS))) return fail(429, `You can send ${GIFTS_PER_DAY} gifts a day. Try again tomorrow!`);
  const r = await socialForPlayer(db(), playerId, body);
  if (!r.ok) return fail(409, r.message);
  after(() => processChainOps(db()).catch(() => undefined));
  return Response.json({ ok: true, message: r.message });
}
