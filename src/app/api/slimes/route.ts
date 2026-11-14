import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { fail, readJson } from "@/server/http";
import { processChainOps } from "@/server/chain-worker";
import { rewardInvite } from "@/server/invites";
import { hatchForPlayer } from "@/server/player-town";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";

const hatchSchema = z.object({
  name: z.string().trim().min(1).max(16).regex(/^[\p{L}\p{N} '-]+$/u, "Letters and numbers only"),
  colour: z.enum(["green", "blue", "pink", "gold", "crystal", "shadow"]).optional(),
});

/** Hatch a new slime for the signed-in player. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `hatch:${playerId}`, 5, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, hatchSchema);
  if (!body) return fail(400, "Give your slime a short name.");
  const r = await hatchForPlayer(db(), playerId, body.name, body.colour);
  if (!r.ok) return fail(409, r.message);
  after(() => processChainOps(db()).catch(() => undefined));
  // A friend who came through an invite link: both keepers get their gift now (once).
  const invited = await rewardInvite(db(), playerId).catch(() => false);
  return Response.json({ ok: true, slimeId: r.slimeId, invited });
}
