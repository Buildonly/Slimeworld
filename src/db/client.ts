import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serverEnv } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { slimePool?: Pool };

/** One pool per process (survives hot reload in dev). */
export function db(): Db {
  const pool =
    globalForDb.slimePool ??
    new Pool({ connectionString: serverEnv().DATABASE_URL, max: 10 });
  globalForDb.slimePool = pool;
  return drizzle(pool, { schema });
}
