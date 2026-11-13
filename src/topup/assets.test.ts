import { describe, expect, it } from "vitest";
import { parseUnits, TOPUP_COINS } from "./assets";

describe("top up amounts", () => {
  it("parses decimals into exact base units", () => {
    expect(parseUnits("5", 6)).toBe(5_000_000n);
    expect(parseUnits("0.25", 6)).toBe(250_000n);
    expect(parseUnits("1.000001", 6)).toBe(1_000_001n);
    expect(parseUnits("0.000000000000000001", 18)).toBe(1n);
  });
  it("rejects junk and too many decimals", () => {
    for (const bad of ["", "-1", "1e3", "1.2.3", "abc", "0.0000001"]) expect(parseUnits(bad, 6)).toBeNull();
  });
  it("lists USDC on Base first", () => {
    expect(TOPUP_COINS[0]).toMatchObject({ id: "usdc-base", decimals: 6 });
  });
});
