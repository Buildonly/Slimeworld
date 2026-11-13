import { db } from "@/db/client";
import { worldToJson } from "@/economy/serialize";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/**
 * The live town as of now, for the fast forward screen, which runs the same
 * engine in the browser from here. Holds no emails or keys.
 */
export async function GET() {
  const world = await loadWorld(db());
  world.journal = [];
  return new Response(worldToJson(world), { headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } });
}
