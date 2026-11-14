import { db } from "@/db/client";
import { leaderboards, myPlace } from "@/economy/leaderboard";
import { currentPlayerId } from "@/server/session";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Town rankings. Public; a signed-in player also sees where their slime stands. */
export async function GET() {
  const world = await loadWorld(db());
  const viewer = await currentPlayerId();
  const boards = leaderboards(world, viewer);
  const places = viewer ? Object.fromEntries(boards.map((b) => [b.id, myPlace(world, viewer, b.id)])) : {};
  return Response.json({ boards, places });
}
