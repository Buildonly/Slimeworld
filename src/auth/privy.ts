import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";

/**
 * Verify Privy tokens with the app's public JWKS. No Privy secret is needed
 * on our server for sign in.
 */
const jwksByApp = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(appId: string) {
  let set = jwksByApp.get(appId);
  if (!set) {
    set = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`));
    jwksByApp.set(appId, set);
  }
  return set;
}

type KeySource = Parameters<typeof jwtVerify>[1];

async function verify(token: string, appId: string, key?: KeySource): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, key ?? jwks(appId), {
    issuer: "privy.io",
    audience: appId,
    algorithms: ["ES256"],
  });
  return payload;
}

/** Returns the Privy user id (did:privy:...) from a valid access token. */
export async function verifyPrivyAccessToken(token: string, appId: string, key?: KeySource): Promise<string> {
  const payload = await verify(token, appId, key);
  return z.string().min(1).parse(payload.sub);
}

const linkedAccountSchema = z
  .object({ type: z.string(), address: z.string().optional(), email: z.string().optional() })
  .loose();

/**
 * Pull the player's email from a Privy identity token, if there is one.
 * Accepts email logins and Google logins. Returns null for anything else.
 */
export async function emailFromIdentityToken(token: string, appId: string, key?: KeySource): Promise<string | null> {
  const payload = await verify(token, appId, key);
  const raw = payload.linked_accounts;
  if (typeof raw !== "string") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const accounts = z.array(linkedAccountSchema).safeParse(parsed);
  if (!accounts.success) return null;
  for (const a of accounts.data) {
    const candidate = a.type === "email" ? a.address : a.type === "google_oauth" ? a.email : undefined;
    const ok = z.email().safeParse(candidate);
    if (ok.success) return ok.data;
  }
  return null;
}
