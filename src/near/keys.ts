import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypt private keys at rest with AES-256-GCM. The secret comes from the
 * environment; the stored form is "v1:<iv>:<tag>:<ciphertext>" in base64url.
 */
function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptKey(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, body].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(":");
}

export function decryptKey(stored: string, secret: string): string {
  const [version, iv, tag, body] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unknown key format");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
