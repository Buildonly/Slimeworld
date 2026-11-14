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
import { ITEMS, TREASURY_FEE_BPS } from "../src/economy/config";
import { contractIds } from "../src/near/contracts";
import { accessKeyBytes, chainPrices, storageCost, withTopUp } from "../src/near/costs";
import { nearText, required } from "./script-env";

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
  const gameId = required("NEAR_GAME_ACCOUNT");
  const key = required("NEAR_GAME_PRIVATE_KEY") as KeyPairString;
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  const prices = await chainPrices(provider);
  // Contract state grows as the town is used; the game tops up only what is missing.
  const owned = (id: string) => id === gameId || id.endsWith(`.${gameId}`);
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
      // Exactly the code and the account's own storage at today's price.
      const funding = storageCost(prices, accessKeyBytes(prices) + BigInt(code.length));
      await game.createAccount({ newAccountId: c.id, publicKey, nearToTransfer: funding });
      console.log(`Created ${c.id} with ${nearText(funding)} NEAR`);
    }
    const contract = new Account(c.id, provider, key);
    await waitForKey(provider, c.id, publicKey.toString());
    await withTopUp(game, owned, () => contract.deployContract(code));
    try {
      await withTopUp(game, owned, () => contract.callFunction({ contractId: c.id, methodName: "new", args: c.init, gas: teraToGas("30") }));
      console.log(`Deployed ${c.wasm} at ${c.id} (${code.length} bytes)`);
    } catch (err) {
      if (!String(err).includes("already been initialized")) throw err;
      console.log(`Upgraded ${c.wasm} at ${c.id} (${code.length} bytes)`);
    }
  }

  // The town may mint, burn and move items for market trades.
  await withTopUp(game, owned, () => game.callFunction({ contractId: ids.items, methodName: "add_minter", args: { account_id: ids.town }, gas: teraToGas("10") }));
  for (const item of ITEMS) {
    await withTopUp(game, owned, () => game.callFunction({
      contractId: ids.items,
      methodName: "define_item",
      args: {
        token_id: item.id,
        metadata: { title: item.title, description: item.description, category: item.category, media: null },
      },
      gas: teraToGas("10"),
    }));
  }
  console.log(`Defined ${ITEMS.length} item types. Done.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
