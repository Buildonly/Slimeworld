/** Cheers and gifts between players, on the locked town. */
import type { Db } from "@/db/client";
import type { Bits } from "@/economy/config";
import { cheer, giftTo, type SocialResult } from "@/economy/social";
import { noChanges, withWorld } from "./world-store";

export type SocialAction = { action: "cheer"; slimeId: string } | { action: "gift"; slimeId: string; amount: Bits };

export async function socialForPlayer(db: Db, playerId: string, a: SocialAction): Promise<SocialResult> {
  const result = await withWorld(db, async (world) => {
    const r = a.action === "cheer" ? cheer(world, playerId, a.slimeId) : giftTo(world, playerId, a.slimeId, a.amount);
    const changes = noChanges();
    changes.moves = world.journal.splice(0); // gifts become the player's own signed, relayed payment on chain
    if (r.ok) changes.events.push(r.event);
    return { result: r, changes };
  });
  return result ?? { ok: false, message: "The town is busy. Try again." };
}
