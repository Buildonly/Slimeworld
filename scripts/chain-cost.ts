/**
 * Print what opening the town and each new player costs, worked out live.
 *   NEAR_RPC_URL=<rpc> pnpm chain:cost <game account> [testnet|mainnet]
 * Needs built contracts (pnpm contracts:build). ONECLICK_URL, if set, adds
 * the wrapped NEAR registration that top ups need.
 */
import "dotenv/config";
import { JsonRpcProvider } from "near-api-js";
import type { Network } from "../src/economy/config";
import { chainPrices } from "../src/near/costs";
import { liveTokens } from "../src/topup/assets";
import { total, workOutCost, type Line } from "./opening-cost";
import { nearText, required } from "./script-env";

function print(title: string, lines: Line[]) {
  console.log(`\n${title}`);
  for (const l of lines) console.log(`  ${l.what}: ${nearText(l.storage + l.gasAtMost)} NEAR`);
  console.log(`  Total: ${nearText(total(lines))} NEAR`);
}

async function main() {
  const [gameId, net] = process.argv.slice(2);
  if (!gameId) throw new Error("Usage: chain-cost <game account> [testnet|mainnet]");
  const network: Network = net === "mainnet" ? "mainnet" : "testnet";
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  const prices = await chainPrices(provider);
  const wrappedNear = network === "mainnet" && process.env.ONECLICK_URL ? (await liveTokens()).destination.contractAddress ?? null : null;
  const cost = await workOutCost({ prices, provider, network, gameId, wrappedNear });
  console.log(`Live prices: storage ${nearText(prices.storagePerByte)} NEAR per byte, gas ${prices.gasPrice} yocto per gas unit.`);
  print("Opening the town", cost.opening);
  print("Each new player", cost.perPlayer);
  for (const n of cost.notes) console.log(`- ${n}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
