import type { Db } from "@/db/client";
import { TICKS_PER_DAY } from "@/economy/config";
import { defaultMinds, runTick, type Minds } from "@/economy/tick";
import type { World } from "@/economy/types";
import { MAIN_WORLD, noChanges, withWorld } from "./world-store";

export { MAIN_WORLD, loadWorld, STARTING_SLIMES } from "./world-store";

/**
 * Run `ticks` ticks. Returns null if another ticker (or a long action) holds
 * the town right now; the next call will catch up.
 */
export async function advanceTown(db: Db, ticks: number, minds: Minds = defaultMinds, id = MAIN_WORLD): Promise<World | null> {
  return withWorld(
    db,
    async (world) => {
      const changes = noChanges();
      for (let i = 0; i < ticks; i++) {
        const out = await runTick(world, minds);
        changes.decisions.push(...out.decisions);
        changes.events.push(...out.events);
        changes.moves.push(...out.moves);
        if (world.tick % TICKS_PER_DAY === 0) changes.dayEnded = true;
      }
      return { result: world, changes };
    },
    { id, wait: false },
  );
}
