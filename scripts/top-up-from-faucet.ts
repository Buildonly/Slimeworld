/**
 * Testnet only: get more test NEAR for the game account. Creates a throwaway
 * faucet account and deletes it straight away with the game account as the
 * beneficiary, so its whole balance moves to the game.
 *
 *   pnpm tsx scripts/top-up-from-faucet.ts
 */
import "dotenv/config";
import { Account, JsonRpcProvider, KeyPair, type KeyPairString } from "near-api-js";
import { randomBytes } from "node:crypto";

async function main() {
  if (process.env.NEAR_NETWORK !== "testnet") throw new Error("Testnet only");
  const game = process.env.NEAR_GAME_ACCOUNT;
  if (!game) throw new Error("NEAR_GAME_ACCOUNT is not set");
  const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com" });
  const id = `slimeworld-tmp-${randomBytes(4).toString("hex")}.testnet`;
  const keyPair = KeyPair.fromRandom("ed25519");
  const res = await fetch("https://helper.nearprotocol.com/account", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: id, newAccountPublicKey: keyPair.getPublicKey().toString() }),
  });
  if (!res.ok) throw new Error(`Faucet said ${res.status}`);
  await new Promise((r) => setTimeout(r, 2000));
  const tmp = new Account(id, provider, keyPair.toString() as KeyPairString);
  await tmp.deleteAccount(game);
  await new Promise((r) => setTimeout(r, 3000));
  const after = await new Account(game, provider).getBalance();
  console.log(`Moved faucet funds to ${game}. Balance now ${(Number(after / 10n ** 21n) / 1000).toFixed(3)} NEAR.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
