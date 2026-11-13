import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { coins } from "@/economy/config";
import { fail, readJson } from "@/server/http";
import { processChainOps } from "@/server/chain-worker";
import { actForPlayer } from "@/server/player-town";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";

const slimeId = z.string().regex(/^s[0-9a-z]{1,10}$/);
const coinsField = z.number().int().min(0).max(1_000_000).transform((n) => coins(n));
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("feed"), slimeId }),
  z.object({ action: z.literal("play"), slimeId }),
  z.object({ action: z.literal("job"), slimeId }),
  z.object({ action: z.literal("give"), slimeId, itemId: z.string().regex(/^[a-z]{2,16}$/) }),
  z.object({ action: z.literal("topup"), slimeId, amount: coinsField }),
  z.object({
    action: z.literal("rules"),
    slimeId,
    rules: z.object({
      dailyLimit: coinsField,
      savingsTarget: coinsField,
      allowed: z.array(z.enum(["Food", "Toy", "Training", "Hat", "Material"])).max(5),
      allowedJobs: z.array(z.enum(["delivery", "helper", "guard", "race", "puzzle"])).max(5),
    }),
  }),
]);

/** One player action on one of their slimes. No wallet popups: the server signs and a relayer pays gas. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `act:${playerId}`, 40, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, actionSchema);
  if (!body) return fail(400, "That action did not look right.");
  const r = await actForPlayer(db(), playerId, body);
  if (!r.ok) return fail(409, r.message);
  after(() => processChainOps(db()).catch(() => undefined));
  return Response.json({ ok: true, message: r.message });
}
