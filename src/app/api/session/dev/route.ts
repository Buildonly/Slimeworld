import { z } from "zod";
import { db } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { clientIp, fail, readJson } from "@/server/http";
import { ensureNearAccount, findOrCreatePlayer } from "@/server/players";
import { allow } from "@/server/rate-limit";
import { setSessionCookie } from "@/server/session";

const bodySchema = z.object({ email: z.email().max(200) });

/**
 * Test sign in without an email code, for local play and automated tests.
 * Off unless DEV_LOGIN=1, and always off in production.
 */
export async function POST(req: Request) {
  const env = serverEnv();
  if (env.DEV_LOGIN !== "1" || env.NODE_ENV === "production") return fail(404, "Not found.");
  if (!(await allow(db(), `devsignin:${await clientIp()}`, 30, 60))) return fail(429, "Slow down a little!");
  const body = await readJson(req, bodySchema);
  if (!body) return fail(400, "Please enter an email.");

  const player = await findOrCreatePlayer(db(), `dev:${body.email.toLowerCase()}`, body.email.toLowerCase());
  await setSessionCookie(player.id);
  try {
    return Response.json({ ok: true, player: await ensureNearAccount(db(), player.id) });
  } catch (err) {
    console.error("NEAR account creation failed:", err instanceof Error ? err.message : "unknown");
    return Response.json({ ok: true, player, pending: true });
  }
}
