import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey } from "./keys";

const secret = "x".repeat(44);

describe("key encryption", () => {
  it("round trips and never stores the plain key", () => {
    const plain = "ed25519:abc123";
    const stored = encryptKey(plain, secret);
    expect(stored).not.toContain("abc123");
    expect(decryptKey(stored, secret)).toBe(plain);
  });

  it("fails with the wrong secret", () => {
    const stored = encryptKey("ed25519:abc", secret);
    expect(() => decryptKey(stored, "y".repeat(44))).toThrow();
  });
});
