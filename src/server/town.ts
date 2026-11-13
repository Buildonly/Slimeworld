import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { decisions, gameEvents, prices, worlds } from "@/db/schema";
import { TICKS_PER_DAY } from "@/economy/config";
import { worldFromJson, worldToJson } from "@/economy/serialize";
import { defaultMinds, runTick, type Minds } from "@/economy/tick";
import type { TickOutput, World } from "@/economy/types";
import { createTown } from "@/economy/world";

export const MAIN_WORLD = "main";
/** The live town starts with this many slimes (docs/SETUP.md: 50 AI slimes). */
export const STARTING_SLIMES = 50;

/** Load the town, creating it the first time. */
export async function loadWorld(db: Db, id = MAIN_WORLD): Promise<World> {
  const [row] = await db.select().from(worlds).where(eq(worlds.id, id));
  if (row) return worldFromJson(JSON.stringify(row.state));
  const world = createTown(Date.now() % 2_147_483_647, STARTING_SLIMES);
  await db.insert(worlds).values({ id, tick: world.tick, state: JSON.parse(worldToJson(world)) }).onConflictDoNothing();
  return world;
}

async function save(db: Db, id: string, world: World, out: TickOutput[]): Promise<void> {
  await db
    .update(worlds)
    .set({ tick: world.tick, state: JSON.parse(worldToJson(world)), updatedAt: new Date() })
    .where(eq(worlds.id, id));
  const allDecisions = out.flatMap((o) => o.decisions);
  for (let i = 0; i < allDecisions.length; i += 500) {
    await db.insert(decisions).values(allDecisions.slice(i, i + 500).map((d) => ({ worldId: id, ...d })));
  }
  const allEvents = out.flatMap((o) => o.events);
  if (allEvents.length) await db.insert(gameEvents).values(allEvents.map((e) => ({ worldId: id, ...e })));
}

async function savePrices(db: Db, id: string, world: World): Promise<void> {
  const day = Math.floor(world.tick / TICKS_PER_DAY);
  const rows = Object.values(world.shops).flatMap((shop) =>
    Object.entries(shop.prices).map(([itemId, p]) => ({ worldId: id, shopId: shop.id, itemId, day, price: p.price, reason: p.reason })),
  );
  if (rows.length) await db.insert(prices).values(rows).onConflictDoNothing();
}

/**
 * Run `ticks` ticks under a Postgres advisory lock, so two tickers (a cron
 * and a fast forward button) never move the town at the same time.
 * Returns null if another ticker holds the lock.
 */
export async function advanceTown(db: Db, ticks: number, minds: Minds = defaultMinds, id = MAIN_WORLD): Promise<World | null> {
  return db.transaction(async (tx) => {
    const lock = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(hashtext(${"world:" + id})) as ok`);
    if (!lock.rows[0]?.ok) return null;
    const world = await loadWorld(tx as unknown as Db, id);
    const outputs: TickOutput[] = [];
    for (let i = 0; i < ticks; i++) {
      outputs.push(await runTick(world, minds));
      if (world.tick % TICKS_PER_DAY === 0) await savePrices(tx as unknown as Db, id, world);
    }
    await save(tx as unknown as Db, id, world, outputs);
    return world;
  });
}
