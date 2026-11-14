/**
 * Deploy (or upgrade) the three contracts under the game account:
 * nft.<game>, items.<game>, town.<game>. Safe to run again: existing
 * accounts get the new code without being re-initialised.
 *
 *   (cd contracts && for c in slime_nft items_mt town; do (cd $c && cargo near build non-reproducible-wasm); done)
 *   pnpm tsx scripts/deploy-contracts.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { CHAIN_SETUP, ITEMS, TREASURY_FEE_BPS, type Network } from "../src/economy/config";
import { contractIds } from "../src/near/contracts";

const STORAGE_YOCTO_PER_BYTE = 10n ** 19n;
const NETWORK = (process.env.NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet") as Network;
const RPC = process.env.NEAR_RPC_URL ?? (NETWORK === "mainnet" ? "https://free.rpc.fastnear.com" : "https://test.rpc.fastnear.com");
/** Room for contract state as the game grows. */
const EXTRA_NEAR = CHAIN_SETUP[NETWORK].contractHeadroomYocto;

async function exists(provider: JsonRpcProvider, id: string): Promise<boolean> {
  try {
    await provider.viewAccount({ accountId: id });
    return true;
  } catch {
    return false;
  }
}

/** A new account can take a moment to show up on the RPC node. */
async function waitForKey(provider: JsonRpcProvider, accountId: string, publicKey: string) {
  for (let i = 0; i < 20; i++) {
    try {
      await provider.viewAccessKey({ accountId, publicKey });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Key for ${accountId} never appeared`);
}

async function main() {
  const gameId = process.env.NEAR_GAME_ACCOUNT;
  const key = process.env.NEAR_GAME_PRIVATE_KEY as KeyPairString | undefined;
  if (!gameId || !key) throw new Error("Set NEAR_GAME_ACCOUNT and NEAR_GAME_PRIVATE_KEY");
  const provider = new JsonRpcProvider({ url: RPC });
  const game = new Account(gameId, provider, key);
  const publicKey = KeyPair.fromString(key).getPublicKey();
  const ids = contractIds(gameId);

  const plan = [
    { id: ids.nft, wasm: "slime_nft", init: { owner_id: gameId } },
    { id: ids.items, wasm: "items_mt", init: { owner_id: gameId } },
    { id: ids.town, wasm: "town", init: { operator_id: gameId, fee_bps: TREASURY_FEE_BPS } },
  ];

  for (const c of plan) {
    const code = readFileSync(`contracts/target/near/${c.wasm}/${c.wasm}.wasm`);
    const fresh = !(await exists(provider, c.id));
    if (fresh) {
      const funding = BigInt(code.length) * STORAGE_YOCTO_PER_BYTE + EXTRA_NEAR;
      await game.createAccount({ newAccountId: c.id, publicKey, nearToTransfer: funding });
      console.log(`Created ${c.id}`);
    }
    const contract = new Account(c.id, provider, key);
    await waitForKey(provider, c.id, publicKey.toString());
    await contract.deployContract(code);
    try {
      await contract.callFunction({ contractId: c.id, methodName: "new", args: c.init, gas: teraToGas("30") });
      console.log(`Deployed ${c.wasm} at ${c.id} (${code.length} bytes)`);
    } catch (err) {
      if (!String(err).includes("already been initialized")) throw err;
      console.log(`Upgraded ${c.wasm} at ${c.id} (${code.length} bytes)`);
    }
  }

  // The town may mint, burn and move items for market trades.
  await game.callFunction({ contractId: ids.items, methodName: "add_minter", args: { account_id: ids.town }, gas: teraToGas("10") });
  for (const item of ITEMS) {
    await game.callFunction({
      contractId: ids.items,
      methodName: "define_item",
      args: {
        token_id: item.id,
        metadata: { title: item.title, description: item.description, category: item.category, media: null },
      },
      gas: teraToGas("10"),
    });
  }
  console.log(`Defined ${ITEMS.length} item types. Done.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
