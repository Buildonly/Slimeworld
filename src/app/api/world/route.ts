import { db } from "@/db/client";
import { worldDto } from "@/lib/views";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

/** Public live view of the whole economy. */
export async function GET() {
  return Response.json(worldDto(await loadWorld(db())));
}
