import { db } from "@/db/client";
import { currentPlayerId } from "@/server/session";
import { townDto } from "@/lib/views";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Shops, prices with reasons, slimes about town and the latest news. Public. */
export async function GET() {
  const world = await loadWorld(db());
  return Response.json(townDto(world, await currentPlayerId()));
}
