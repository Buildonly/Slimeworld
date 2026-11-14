/**
 * Keep the town running on hosts with no always-on ticker (Vercel): any
 * request can call this, and it runs the ticks that are due since the last
 * one. Ticks are claimed atomically, so two requests never run the same ones.
 */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { worlds } from "@/db/schema";
import { CATCH_UP_TICKS_PER_CALL, TICK_SECONDS_NORMAL } from "@/economy/config";
import { defaultMinds } from "@/economy/tick";
import { liveMinds } from "@/minds/live-minds";
import { processChainOps } from "./chain-worker";
import { advanceTown } from "./town";
import { MAIN_WORLD } from "./world-store";

const TICK_MS = TICK_SECONDS_NORMAL * 1000;

/** How many ticks are due, and when the claimed ticks end. Pure, for tests. */
export function dueTicks(tickedAt: Date, now: Date): { due: number; next: Date } {
  const due = Math.min(CATCH_UP_TICKS_PER_CALL, Math.floor((now.getTime() - tickedAt.getTime()) / TICK_MS));
  return { due: Math.max(0, due), next: new Date(tickedAt.getTime() + Math.max(0, due) * TICK_MS) };
}

export async function catchUp(db: Db, now = new Date()): Promise<number> {
  const [row] = await db.select({ tickedAt: worlds.tickedAt }).from(worlds).where(eq(worlds.id, MAIN_WORLD));
  if (!row) return 0;
  const { due, next } = dueTicks(row.tickedAt, now);
  if (due === 0) return 0;
  // Claim these ticks: only one request wins the update.
  const claimed = await db
    .update(worlds)
    .set({ tickedAt: next })
    .where(and(eq(worlds.id, MAIN_WORLD), sql`${worlds.tickedAt} = ${row.tickedAt}`))
    .returning({ id: worlds.id });
  if (!claimed.length) return 0;
  // A backlog runs on the free minds; a single live tick thinks on NEAR AI.
  const world = await advanceTown(db, due, due === 1 ? liveMinds() : defaultMinds);
  if (!world) {
    await db.update(worlds).set({ tickedAt: row.tickedAt }).where(eq(worlds.id, MAIN_WORLD)); // give the ticks back
    return 0;
  }
  await processChainOps(db).catch(() => undefined);
  return due;
}
