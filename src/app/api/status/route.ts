import { after } from "next/server";
import { db } from "@/db/client";
import { catchUp } from "@/server/catch-up";
import { serverEnv } from "@/lib/env";
import { gameAccount } from "@/near/client";
import { contractIds } from "@/near/contracts";
import { currentPlayerId } from "@/server/session";
import { clock } from "@/lib/views";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Small, cheap status for the header: the town clock and the viewer's coins. */
export async function GET() {
  // Everyone's header polls this, so the town keeps ticking without a server process.
  after(() => catchUp(db()).catch((err: unknown) => console.error("Town catch-up failed:", err instanceof Error ? err.message : "unknown")));
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
