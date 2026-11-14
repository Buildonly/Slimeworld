/**
 * Print what running the town costs, worked out live.
 *   pnpm chain:cost <game account>
 * Contracts run on testnet (NEAR_RPC_URL). On mainnet the game needs nothing
 * up front: top ups land in the treasury's NEAR Intents balance.
 * Needs built contracts (pnpm contracts:build).
 */
import "dotenv/config";
import { JsonRpcProvider } from "near-api-js";
import { chainPrices } from "../src/near/costs";
import { total, workOutCost, type Line } from "./opening-cost";
import { nearText, required } from "./script-env";

function print(title: string, lines: Line[]) {
  console.log(`\n${title}`);
  for (const l of lines) console.log(`  ${l.what}: ${nearText(l.storage + l.gasAtMost)} NEAR`);
  console.log(`  Total: ${nearText(total(lines))} NEAR`);
}

async function main() {
  const [gameId] = process.argv.slice(2);
  if (!gameId) throw new Error("Usage: chain-cost <game account>");
  const prices = await chainPrices(new JsonRpcProvider({ url: required("NEAR_RPC_URL") }));
  const cost = workOutCost({ prices, gameId });
  console.log(`Live prices on ${process.env.NEAR_NETWORK ?? "the contracts' network"}: storage ${nearText(prices.storagePerByte)} NEAR per byte, gas ${prices.gasPrice} yocto per gas unit.`);
  print("Opening the town (test NEAR)", cost.opening);
  print("Each new player (test NEAR)", cost.perPlayer);
  console.log("\nMainnet: 0 NEAR to open and 0 NEAR per player. Top ups go straight to the treasury's NEAR Intents balance.");
  for (const n of cost.notes) console.log(`- ${n}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
