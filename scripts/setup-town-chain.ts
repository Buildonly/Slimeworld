/**
 * One-time setup for gasless play on the live town:
 * - relayer.<game>: pays gas for players' meta transactions (NEP-366)
 * - opens every town shop on the town contract (keeper ledger k-<shop>.<game>)
 * - coin floats so shop keepers and the game can pay wages and prizes on chain
 * Safe to run again.
 *   pnpm tsx --tsconfig tsconfig.json scripts/setup-town-chain.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { CHAIN_SETUP, STARTING_SHOPS, YOCTO_PER_BIT, type Network } from "@/economy/config";
import { contractIds } from "@/near/contracts";

const NETWORK = (process.env.NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet") as Network;
const RPC = process.env.NEAR_RPC_URL ?? (NETWORK === "mainnet" ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com");
const RELAYER_FUNDING = CHAIN_SETUP[NETWORK].relayerYocto;
const KEEPER_FLOAT = CHAIN_SETUP[NETWORK].keeperFloat * YOCTO_PER_BIT;
const GAME_FLOAT = CHAIN_SETUP[NETWORK].gameFloat * YOCTO_PER_BIT;
/** Env files to update: the network's own file when bootstrapping mainnet. */
const ENV_FILES = (process.env.DOTENV_CONFIG_PATH ?? ".env,.env.local").split(",");

function setEnv(key: string, value: string) {
  for (const file of ENV_FILES) {
    const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    writeFileSync(file, lines.join("\n"));
  }
}

async function main() {
  const gameId = process.env.NEAR_GAME_ACCOUNT;
  const key = process.env.NEAR_GAME_PRIVATE_KEY as KeyPairString | undefined;
  if (!gameId || !key) throw new Error("Set NEAR_GAME_ACCOUNT and NEAR_GAME_PRIVATE_KEY");
  const provider = new JsonRpcProvider({ url: RPC });
  const game = new Account(gameId, provider, key);
  const { town } = contractIds(gameId);
  const gas = teraToGas("50");

  const relayerId = `relayer.${gameId}`;
  if (!process.env.NEAR_RELAYER_PRIVATE_KEY) {
    const kp = KeyPair.fromRandom("ed25519");
    await game.createAccount({ newAccountId: relayerId, publicKey: kp.getPublicKey(), nearToTransfer: RELAYER_FUNDING });
    setEnv("NEAR_RELAYER_ACCOUNT", relayerId);
    setEnv("NEAR_RELAYER_PRIVATE_KEY", kp.toString());
    console.log(`Created ${relayerId} (key saved to .env files).`);
  } else console.log(`Relayer ${relayerId} already set up.`);

  for (const shop of STARTING_SHOPS) {
    const keeper = `k-${shop.id}.${gameId}`;
    await game.callFunction({ contractId: town, methodName: "open_shop", args: { shop_id: shop.id, keeper_id: keeper }, gas });
    const balance = BigInt((await provider.callFunction<string>({ contractId: town, method: "balance_of", args: { account_id: keeper } })) ?? "0");
    if (balance < KEEPER_FLOAT) await game.callFunction({ contractId: town, methodName: "deposit", args: { account_id: keeper }, deposit: KEEPER_FLOAT - balance, gas });
    console.log(`Shop ${shop.name} open on chain (keeper ${keeper}).`);
  }
  const gameBalance = BigInt((await provider.callFunction<string>({ contractId: town, method: "balance_of", args: { account_id: gameId } })) ?? "0");
  if (gameBalance < GAME_FLOAT) await game.callFunction({ contractId: town, methodName: "deposit", args: { account_id: gameId }, deposit: GAME_FLOAT - gameBalance, gas });
  console.log("Game ledger float ready. Done.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
