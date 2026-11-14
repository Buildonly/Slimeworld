/**
 * Keep the town running: one tick every TICK_SECONDS_NORMAL seconds.
 *   pnpm ticker            normal speed (1 game hour per minute)
 *   pnpm ticker --fast     fast forward (1 game day per 10 seconds)
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { worlds } from "@/db/schema";
import { MAIN_WORLD } from "@/server/world-store";
import { TICK_SECONDS_FAST, TICK_SECONDS_NORMAL } from "@/economy/config";
import { formatCoins } from "@/economy/money";
import { liveMinds } from "@/minds/live-minds";
import { processChainOps } from "@/server/chain-worker";
import { advanceTown } from "@/server/town";

const fast = process.argv.includes("--fast");
const seconds = fast ? TICK_SECONDS_FAST : TICK_SECONDS_NORMAL;
let running = true;
process.on("SIGINT", () => (running = false));
process.on("SIGTERM", () => (running = false));

async function main() {
  console.log(`Town ticker running, one tick every ${seconds.toFixed(2)}s${fast ? " (fast forward)" : ""}.`);
  while (running) {
    const started = Date.now();
    const world = await advanceTown(db(), 1, fast ? undefined : liveMinds());
    // Tell request-driven catch-up this tick is done, so the two never double up.
    if (world) await db().update(worlds).set({ tickedAt: new Date() }).where(eq(worlds.id, MAIN_WORLD));
    if (world) {
      const open = Object.values(world.shops).filter((s) => s.open).length;
      const coins = Object.values(world.slimes).reduce((a, s) => a + s.wallet, 0n);
      console.log(`tick ${world.tick} · day ${Math.floor(world.tick / 24)} · ${open} shops open · slimes hold ${formatCoins(coins)} coins`);
    } else console.log("Another ticker is running; waiting.");
    // Mirror this tick's money for real players on chain (gasless: the game and relayer pay).
    if (!fast) await processChainOps(db()).catch((err: unknown) => console.error("Chain worker:", err instanceof Error ? err.message : err));
    await new Promise((r) => setTimeout(r, Math.max(0, seconds * 1000 - (Date.now() - started))));
  }
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
