import { db } from "@/db/client";
import { INVITE_GIFT } from "@/economy/config";
import { clanBoard, myClan } from "@/server/clans";
import { fail } from "@/server/http";
import { inviteCode } from "@/server/invites";
import { currentPlayerId } from "@/server/session";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Your invite code, your clan, and the clan ranks. */
export async function GET() {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  const world = await loadWorld(db());
  return Response.json({
    ok: true,
    inviteCode: await inviteCode(db(), playerId),
    inviteGift: INVITE_GIFT.toString(),
    clan: await myClan(db(), world, playerId),
    clans: await clanBoard(db(), world, playerId, 10),
  });
}
