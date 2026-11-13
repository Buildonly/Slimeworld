import { db } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { gameAccount } from "@/near/client";
import { contractIds } from "@/near/contracts";
import { currentPlayerId } from "@/server/session";
import { clock } from "@/lib/views";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Small, cheap status for the header: the town clock and the viewer's coins. */
export async function GET() {
  const world = await loadWorld(db());
  const id = await currentPlayerId();
  const player = id ? world.players[id] : undefined;
  const game = gameAccount()?.accountId ?? "";
  return Response.json({
    clock: clock(world),
    signedIn: Boolean(id),
    coins: player?.wallet.toString() ?? null,
    town: contractIds(game).town,
    network: serverEnv().NEAR_NETWORK,
  });
}
