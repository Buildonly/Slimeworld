/**
 * Coins players can top up with, from any chain, through NEAR Intents 1Click.
 * Asset ids come from GET https://1click.chaindefuser.com/v0/tokens.
 */
export type TopUpCoin = { id: string; label: string; chain: string; symbol: string; assetId: string; decimals: number };

export const TOPUP_COINS: readonly TopUpCoin[] = [
  { id: "usdc-base", label: "USDC on Base", chain: "Base", symbol: "USDC", assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", decimals: 6 },
  { id: "usdc-arb", label: "USDC on Arbitrum", chain: "Arbitrum", symbol: "USDC", assetId: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near", decimals: 6 },
  { id: "usdc-eth", label: "USDC on Ethereum", chain: "Ethereum", symbol: "USDC", assetId: "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near", decimals: 6 },
  { id: "usdc-near", label: "USDC on NEAR", chain: "NEAR", symbol: "USDC", assetId: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", decimals: 6 },
  { id: "eth-base", label: "ETH on Base", chain: "Base", symbol: "ETH", assetId: "nep141:base.omft.near", decimals: 18 },
  { id: "eth", label: "ETH", chain: "Ethereum", symbol: "ETH", assetId: "nep141:eth.omft.near", decimals: 18 },
  { id: "sol", label: "SOL", chain: "Solana", symbol: "SOL", assetId: "nep141:sol.omft.near", decimals: 9 },
  { id: "btc", label: "BTC", chain: "Bitcoin", symbol: "BTC", assetId: "nep141:btc.omft.near", decimals: 8 },
];

/** What lands on NEAR: wrapped NEAR, unwrapped into the player's account. */
export const DESTINATION_ASSET = "nep141:wrap.near";

/** "12.5" with 6 decimals -> 12500000n. Rejects anything that isn't a plain decimal. Never uses floats. */
export function parseUnits(amount: string, decimals: number): bigint | null {
  const m = /^(\d{1,12})(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return BigInt(m[1]!) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}
