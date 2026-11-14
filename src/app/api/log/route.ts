import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { decisions, slimeAccounts } from "@/db/schema";
import { fail } from "@/server/http";
import { currentPlayerId } from "@/server/session";
import { decisionDto } from "@/lib/views";
import { MAIN_WORLD } from "@/server/world-store";

export const dynamic = "force-dynamic";

const query = z.object({ slimeId: z.string().regex(/^s[0-9a-z]{1,10}$/), before: z.coerce.number().int().positive().optional() });

/** A player's slime's decisions, newest first. Only the owner may read them. */
export async function GET(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return fail(400, "Which slime?");
  const { slimeId, before } = parsed.data;
  const [owned] = await db()
    .select()
    .from(slimeAccounts)
    .where(and(eq(slimeAccounts.worldId, MAIN_WORLD), eq(slimeAccounts.slimeId, slimeId), eq(slimeAccounts.playerId, playerId)));
  if (!owned) return fail(404, "Slime not found.");
  const rows = await db()
    .select()
    .from(decisions)
    .where(and(eq(decisions.worldId, MAIN_WORLD), eq(decisions.actorId, slimeId), before ? lt(decisions.id, before) : undefined))
    .orderBy(desc(decisions.id))
    .limit(40);
  return Response.json({ decisions: rows.map((r) => decisionDto(r)), account: owned.accountId });
}
