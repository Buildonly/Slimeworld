import { db } from "@/db/client";
import { fail } from "@/server/http";
import { ensureNearAccount, getPlayer } from "@/server/players";
import { currentPlayerId } from "@/server/session";

/** The signed-in player. Finishes NEAR account creation if it was interrupted. */
export async function GET() {
  const id = await currentPlayerId();
  if (!id) return fail(401, "Please sign in.");
  const player = await getPlayer(db(), id);
  if (!player) return fail(401, "Please sign in.");
  if (player.nearAccountId) return Response.json({ ok: true, player });
  try {
    return Response.json({ ok: true, player: await ensureNearAccount(db(), id) });
  } catch {
    return Response.json({ ok: true, player, pending: true });
  }
}
