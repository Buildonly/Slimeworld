import { z } from "zod";
import { db } from "@/db/client";
import { profileDto } from "@/lib/views";
import { fail } from "@/server/http";
import { currentPlayerId } from "@/server/session";
import { loadWorld } from "@/server/world-store";

export const dynamic = "force-dynamic";

const idSchema = z.string().regex(/^s[0-9a-z]{1,10}$/);

/** A slime's public page. Anyone may read it; nothing private is in it. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail(404, "No slime by that name.");
  const world = await loadWorld(db());
  const slime = world.slimes[id.data];
  if (!slime) return fail(404, "That slime isn't around.");
  return Response.json({ ok: true, profile: profileDto(world, slime, await currentPlayerId()) });
}
