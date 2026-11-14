import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/** Liveness check: is the server up and can it reach the database? */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
