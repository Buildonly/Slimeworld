import { Account, JsonRpcProvider, type KeyPairString } from "near-api-js";
import { serverEnv } from "@/lib/env";
import { chainPrices, type ChainPrices } from "./costs";

let provider: JsonRpcProvider | undefined;

/** Shared RPC provider for the configured network (NEAR_RPC_URL). */
export function nearProvider(): JsonRpcProvider {
  const url = serverEnv().NEAR_RPC_URL;
  if (!url) throw new Error("NEAR_RPC_URL is not set");
  provider ??= new JsonRpcProvider({ url });
  return provider;
}

/** The account that owns the game contracts and creates player accounts. Null when not configured. */
export function gameAccount(): Account | null {
  const env = serverEnv();
  if (!env.NEAR_GAME_ACCOUNT || !env.NEAR_GAME_PRIVATE_KEY || !env.NEAR_RPC_URL) return null;
  return new Account(env.NEAR_GAME_ACCOUNT, nearProvider(), env.NEAR_GAME_PRIVATE_KEY as KeyPairString);
}

/** Accounts the game created and may top up: itself and its sub accounts. */
export function ownedByGame(gameId: string): (accountId: string) => boolean {
  return (id) => id === gameId || id.endsWith(`.${gameId}`);
}

let prices: { at: number; value: ChainPrices } | undefined;

/** Live storage and gas prices, re-read at most once a minute. */
export async function livePrices(): Promise<ChainPrices> {
  if (prices && Date.now() - prices.at < 60_000) return prices.value;
  prices = { at: Date.now(), value: await chainPrices(nearProvider()) };
  return prices.value;
}
