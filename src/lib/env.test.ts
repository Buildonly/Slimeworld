import { afterEach, describe, expect, it, vi } from "vitest";

describe("serverEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("treats empty strings as missing and applies defaults", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://a:b@localhost:5432/x");
    vi.stubEnv("NEAR_AI_API_KEY", "");
    vi.stubEnv("NEAR_NETWORK", "");
    const { serverEnv } = await import("./env");
    const env = serverEnv();
    expect(env.NEAR_AI_API_KEY).toBeUndefined();
    expect(env.NEAR_NETWORK).toBe("testnet");
  });

  it("names the bad variable without printing its value", async () => {
    vi.stubEnv("DATABASE_URL", "not a url");
    const { serverEnv } = await import("./env");
    expect(() => serverEnv()).toThrow(/DATABASE_URL/);
    expect(() => serverEnv()).not.toThrow(/not a url/);
  });
});
