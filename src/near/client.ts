import { Account, JsonRpcProvider, type KeyPairString } from "near-api-js";
import { serverEnv } from "@/lib/env";

const DEFAULT_RPC = {
  testnet: "https://test.rpc.fastnear.com",
  mainnet: "https://free.rpc.fastnear.com",
} as const;

let provider: JsonRpcProvider | undefined;

/** Shared RPC provider for the configured network. */
export function nearProvider(): JsonRpcProvider {
  const env = serverEnv();
  provider ??= new JsonRpcProvider({ url: env.NEAR_RPC_URL ?? DEFAULT_RPC[env.NEAR_NETWORK] });
  return provider;
}

/** The account that owns the game contracts and creates player accounts. Null when not configured. */
export function gameAccount(): Account | null {
  const env = serverEnv();
  if (!env.NEAR_GAME_ACCOUNT || !env.NEAR_GAME_PRIVATE_KEY) return null;
  return new Account(env.NEAR_GAME_ACCOUNT, nearProvider(), env.NEAR_GAME_PRIVATE_KEY as KeyPairString);
}
