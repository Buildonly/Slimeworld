import { db } from "@/db/client";
import { BOARD_SIZE, leaderboards, myPlace } from "@/economy/leaderboard";
import { clanBoard } from "@/server/clans";
import { currentPlayerId } from "@/server/session";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Town rankings. Public; a signed-in player also sees where their slime stands. */
export async function GET() {
  const world = await loadWorld(db());
  const viewer = await currentPlayerId();
  const boards = leaderboards(world, viewer);
  const clans = await clanBoard(db(), world, viewer, BOARD_SIZE);
  boards.splice(boards.length - 1, 0, {
    id: "clans",
    title: "Top clans",
    blurb: "Clans by everything their keepers and slimes hold.",
    entries: clans.map((c) => ({ rank: c.rank, id: c.id, name: c.name, sub: `${c.members} keeper${c.members === 1 ? "" : "s"} · ${c.wins} wins`, colour: null, value: c.coins, unit: "coins", mine: c.mine })),
  });
  const places = viewer ? Object.fromEntries(boards.map((b) => [b.id, myPlace(world, viewer, b.id)])) : {};
  return Response.json({ boards, places });
}
