import { db } from "@/db/client";
import { currentPlayerId } from "@/server/session";
import { townDto } from "@/lib/views";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Shops, prices with reasons, slimes about town and the latest news. Public. */
export async function GET(req: Request) {
  const world = await loadWorld(db());
  // ?view=public is the same town for everyone (the landing page): the edge
  // may serve it for a few seconds so the first page answers at once. It
  // never looks at the session, so a cached copy can't leak anyone's view.
  if (new URL(req.url).searchParams.get("view") === "public") {
    return Response.json(townDto(world, null), { headers: { "cache-control": "public, s-maxage=5, stale-while-revalidate=30" } });
  }
  return Response.json(townDto(world, await currentPlayerId()), { headers: { "cache-control": "private, no-store" } });
}
