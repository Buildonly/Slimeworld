import { db } from "@/db/client";
import { fail } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { refreshTopUp } from "@/server/topups";

export const dynamic = "force-dynamic";

/** Where a top up is now; credits coins the moment the swap is done. Owner only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail(404, "Not found.");
  if (!(await allow(db(), `topup-status:${playerId}`, 40, 60))) return fail(429, "Slow down a little!");
  const r = await refreshTopUp(db(), playerId, id).catch(() => null);
  if (!r) return fail(404, "Not found.");
  return Response.json({ ok: true, topUp: r });
}
