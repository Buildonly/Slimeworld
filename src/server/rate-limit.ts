import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";

/**
 * Fixed-window rate limit stored in Postgres, so it holds across server
 * instances. Returns true when the call is allowed.
 */
export async function allow(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const result = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`);
  const count = Number(result.rows[0]?.count ?? 0);
  return count <= limit;
}

/** Drop windows older than a day. Called by the ticker now and then. */
export async function pruneRateLimits(db: Db): Promise<void> {
  await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
}
