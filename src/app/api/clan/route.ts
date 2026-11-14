import { z } from "zod";
import { db } from "@/db/client";
import { createClan, joinClan, leaveClan } from "@/server/clans";
import { fail, readJson } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N} '\-]+$/u) }),
  z.object({ action: z.literal("join"), code: z.string().trim().regex(/^[0-9a-z]{6}$/) }),
  z.object({ action: z.literal("leave") }),
]);

/** Found, join or leave a clan. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `clan:${playerId}`, 10, 300))) return fail(429, "Slow down a little!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "Clan names are 3 to 24 letters; codes are 6 letters or numbers.");
  const r = body.action === "create" ? await createClan(db(), playerId, body.name) : body.action === "join" ? await joinClan(db(), playerId, body.code) : await leaveClan(db(), playerId);
  if (!r.ok) return fail(409, r.message);
  return Response.json({ ok: true, message: r.message });
}
