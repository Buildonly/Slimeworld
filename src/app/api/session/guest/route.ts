import { randomBytes } from "node:crypto";
import { db } from "@/db/client";
import { clientIp, fail } from "@/server/http";
import { ensureNearAccount, findOrCreatePlayer } from "@/server/players";
import { allow } from "@/server/rate-limit";
import { setSessionCookie } from "@/server/session";

/**
 * Play straight away as a guest: no email, no wallet. The guest gets free
 * play coins like everyone else; the session cookie keeps their slime.
 */
export async function POST() {
  if (!(await allow(db(), `guest:${await clientIp()}`, 5, 3600))) return fail(429, "Too many new guests from here. Try again later!");
  const player = await findOrCreatePlayer(db(), `guest:${randomBytes(16).toString("hex")}`, null);
  await setSessionCookie(player.id);
  try {
    return Response.json({ ok: true, player: await ensureNearAccount(db(), player.id) });
  } catch (err) {
    console.error("NEAR account creation failed:", err instanceof Error ? err.message : "unknown");
    return Response.json({ ok: true, player, pending: true });
  }
}
