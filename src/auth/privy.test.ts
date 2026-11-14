import { describe, expect, it } from "vitest";
import { SignJWT, generateKeyPair } from "jose";
import { emailFromIdentityToken, verifyPrivyAccessToken } from "./privy";

const appId = "app-test";

async function token(claims: Record<string, unknown>, opts: { aud?: string; iss?: string } = {}) {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(opts.iss ?? "privy.io")
    .setAudience(opts.aud ?? appId)
    .setSubject("did:privy:abc")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  return { jwt, publicKey };
}

describe("Privy token checks", () => {
  it("accepts a valid access token", async () => {
    const { jwt, publicKey } = await token({});
    await expect(verifyPrivyAccessToken(jwt, appId, publicKey)).resolves.toBe("did:privy:abc");
  });

  it("rejects a token for another app", async () => {
    const { jwt, publicKey } = await token({}, { aud: "other" });
    await expect(verifyPrivyAccessToken(jwt, appId, publicKey)).rejects.toThrow();
  });

  it("rejects a token from another issuer", async () => {
    const { jwt, publicKey } = await token({}, { iss: "evil.example" });
    await expect(verifyPrivyAccessToken(jwt, appId, publicKey)).rejects.toThrow();
  });

  it("reads email and Google addresses from identity tokens", async () => {
    const email = await token({ linked_accounts: JSON.stringify([{ type: "email", address: "a@b.co" }]) });
    await expect(emailFromIdentityToken(email.jwt, appId, email.publicKey)).resolves.toBe("a@b.co");
    const google = await token({ linked_accounts: JSON.stringify([{ type: "google_oauth", email: "g@b.co" }]) });
    await expect(emailFromIdentityToken(google.jwt, appId, google.publicKey)).resolves.toBe("g@b.co");
  });

  it("returns null for junk linked accounts", async () => {
    const junk = await token({ linked_accounts: "not json" });
    await expect(emailFromIdentityToken(junk.jwt, appId, junk.publicKey)).resolves.toBeNull();
  });
});
