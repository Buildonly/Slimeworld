/**
 * Coins players can top up with: whatever NEAR Intents 1Click supports right
 * now, read live from its token list (cached for a few minutes). Nothing is
 * written down here; the destination is 1Click's wrapped NEAR on NEAR.
 */
import { z } from "zod";
import { oneClickUrl } from "./oneclick-url";

const tokenSchema = z.object({
  assetId: z.string().min(1),
  decimals: z.number().int().min(0).max(36),
  blockchain: z.string().min(1),
  symbol: z.string().min(1),
  price: z.number().optional(),
  contractAddress: z.string().optional(),
});
export type Token = z.infer<typeof tokenSchema>;
export type TopUpCoin = { id: string; label: string; chain: string; symbol: string; assetId: string; decimals: number };
export type TokenBook = { coins: TopUpCoin[]; destination: Token };

/** 1Click's own name for wrapped NEAR on the NEAR chain: the token every top up becomes. */
const WRAPPED_NEAR = { blockchain: "near", symbol: "wNEAR" } as const;
const CACHE_MS = 5 * 60 * 1000;

/** Turn 1Click's token list into the coins a player can pick, plus the wrapped NEAR destination. */
export function tokenBook(raw: unknown): TokenBook {
  const tokens = z.array(z.unknown()).parse(raw).flatMap((t) => {
    const r = tokenSchema.safeParse(t);
    return r.success ? [r.data] : []; // drop anything that doesn't match
  });
  const destination = tokens.find((t) => t.blockchain === WRAPPED_NEAR.blockchain && t.symbol === WRAPPED_NEAR.symbol && t.contractAddress);
  if (!destination) throw new Error("1Click lists no wrapped NEAR");
  const coins = tokens
    .filter((t) => t.assetId !== destination.assetId)
    .map((t) => ({ id: t.assetId, label: `${t.symbol} · ${t.blockchain.toUpperCase()}`, chain: t.blockchain, symbol: t.symbol, assetId: t.assetId, decimals: t.decimals }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.chain.localeCompare(b.chain));
  return { coins, destination };
}

let cache: { at: number; book: TokenBook } | undefined;

export async function liveTokens(fetcher: typeof fetch = fetch): Promise<TokenBook> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.book;
  const res = await fetcher(`${oneClickUrl()}/v0/tokens`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`1Click: HTTP ${res.status}`);
  cache = { at: Date.now(), book: tokenBook(await res.json()) };
  return cache.book;
}

/** The wrapped NEAR contract on NEAR, as 1Click reports it. */
export async function wrappedNearContract(): Promise<string> {
  return (await liveTokens()).destination.contractAddress!;
}

/** "12.5" with 6 decimals -> 12500000n. Rejects anything that isn't a plain decimal. Never uses floats. */
export function parseUnits(amount: string, decimals: number): bigint | null {
  const m = /^(\d{1,12})(?:\.(\d+))?$/.exec(amount.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > decimals) return null;
  return BigInt(m[1]!) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}
