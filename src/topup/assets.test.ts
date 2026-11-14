import { describe, expect, it } from "vitest";
import { parseUnits, tokenBook } from "./assets";

const wrapped = { assetId: "nep141:wrapped", decimals: 24, blockchain: "near", symbol: "wNEAR", contractAddress: "wrapped.example" };

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
});

describe("live token list", () => {
  it("finds wrapped NEAR and lists the most widely held coins first", () => {
    const book = tokenBook([
      { assetId: "x:usdc-b", decimals: 6, blockchain: "base", symbol: "USDC" },
      wrapped,
      { assetId: "x:aaa", decimals: 8, blockchain: "sol", symbol: "AAA" },
      { assetId: "x:usdc-a", decimals: 6, blockchain: "arb", symbol: "USDC" },
      { junk: 1 },
    ]);
    expect(book.destination.contractAddress).toBe("wrapped.example");
    expect(book.coins.map((c) => c.id)).toEqual(["x:usdc-a", "x:usdc-b", "x:aaa"]);
    expect(book.coins[1]).toMatchObject({ label: "USDC · BASE", decimals: 6 });
  });
  it("fails loudly when wrapped NEAR is missing", () => {
    expect(() => tokenBook([{ assetId: "x", decimals: 6, blockchain: "base", symbol: "USDC" }])).toThrow();
  });
});
