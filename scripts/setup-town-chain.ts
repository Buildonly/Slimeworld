/**
 * One-time setup for gasless play on the live town:
 * - relayer.<game>: pays gas for players' meta transactions (NEP-366). It is
 *   created with exactly its own storage at today's price; the game tops it
 *   up by the shortfall whenever it can't cover a relay.
 * - opens every town shop on the town contract (keeper ledger k-<shop>.<game>).
 *   Keepers hold no float: the game deposits exactly what a payout needs,
 *   right before it is paid.
 * Safe to run again.
 *   pnpm tsx --tsconfig tsconfig.json scripts/setup-town-chain.ts
 */
import "dotenv/config";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { STARTING_SHOPS } from "@/economy/config";
import { contractIds } from "@/near/contracts";
import { accessKeyBytes, chainPrices, storageCost, withTopUp } from "@/near/costs";
import { nearText, required, setEnv } from "./script-env";

async function main() {
  const gameId = required("NEAR_GAME_ACCOUNT");
  const key = required("NEAR_GAME_PRIVATE_KEY") as KeyPairString;
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  const game = new Account(gameId, provider, key);
  const owned = (id: string) => id === gameId || id.endsWith(`.${gameId}`);
  const { town } = contractIds(gameId);
  const gas = teraToGas("50");
  const prices = await chainPrices(provider);

  const relayerId = `relayer.${gameId}`;
  if (!process.env.NEAR_RELAYER_PRIVATE_KEY) {
    const kp = KeyPair.fromRandom("ed25519");
    const funding = storageCost(prices, accessKeyBytes(prices));
    await game.createAccount({ newAccountId: relayerId, publicKey: kp.getPublicKey(), nearToTransfer: funding });
    setEnv("NEAR_RELAYER_ACCOUNT", relayerId);
    setEnv("NEAR_RELAYER_PRIVATE_KEY", kp.toString());
    console.log(`Created ${relayerId} with ${nearText(funding)} NEAR (its storage). Key saved to the env files.`);
  } else console.log(`Relayer ${relayerId} already set up.`);

  for (const shop of STARTING_SHOPS) {
    const keeper = `k-${shop.id}.${gameId}`;
    await withTopUp(game, owned, () => game.callFunction({ contractId: town, methodName: "open_shop", args: { shop_id: shop.id, keeper_id: keeper }, gas }));
    console.log(`Shop ${shop.name} open on chain (keeper ${keeper}).`);
  }
  console.log("Done.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
