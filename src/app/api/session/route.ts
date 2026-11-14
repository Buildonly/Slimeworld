import { z } from "zod";
import { db } from "@/db/client";
import { emailFromIdentityToken, verifyPrivyAccessToken } from "@/auth/privy";
import { serverEnv } from "@/lib/env";
import { clientIp, fail, readJson } from "@/server/http";
import { ensureNearAccount, signInFrom } from "@/server/players";
import { applyInviteCookie } from "@/server/invites";
import { allow } from "@/server/rate-limit";
import { clearSessionCookie, currentPlayerId, setSessionCookie } from "@/server/session";

const bodySchema = z.object({
  accessToken: z.string().min(10).max(4000),
  identityToken: z.string().min(10).max(8000).nullish(),
});

/** Sign in: swap a Privy token for our own session and make sure the player has a NEAR account. */
export async function POST(req: Request) {
  const env = serverEnv();
  if (!env.NEXT_PUBLIC_PRIVY_APP_ID) return fail(503, "Sign in is not set up yet.");
  if (!(await allow(db(), `signin:${await clientIp()}`, 20, 60))) return fail(429, "Slow down a little!");

  const body = await readJson(req, bodySchema);
  if (!body) return fail(400, "That sign in did not look right.");

  let authId: string;
  let email: string | null = null;
  try {
    authId = await verifyPrivyAccessToken(body.accessToken, env.NEXT_PUBLIC_PRIVY_APP_ID);
    if (body.identityToken) email = await emailFromIdentityToken(body.identityToken, env.NEXT_PUBLIC_PRIVY_APP_ID);
  } catch {
    return fail(401, "Your sign in expired. Please try again.");
  }

  const player = await signInFrom(db(), await currentPlayerId(), authId, email);
  await setSessionCookie(player.id);
  await applyInviteCookie(db(), player.id).catch(() => undefined);
  try {
    return Response.json({ ok: true, player: await ensureNearAccount(db(), player.id) });
  } catch (err) {
    console.error("NEAR account creation failed:", err instanceof Error ? err.message : "unknown");
    return Response.json({ ok: true, player, pending: true });
  }
}

/** Sign out. */
export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
