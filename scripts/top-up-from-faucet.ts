/**
 * Testnet only: get more test NEAR for the game account. Creates a throwaway
 * faucet account and deletes it straight away with the game account as the
 * beneficiary, so its whole balance moves to the game.
 *
 *   NEAR_FAUCET_URL=<faucet> pnpm tsx scripts/top-up-from-faucet.ts
 */
import "dotenv/config";
import { Account, JsonRpcProvider, KeyPair, type KeyPairString } from "near-api-js";
import { randomBytes } from "node:crypto";
import { nearText, required } from "./script-env";

async function main() {
  if (process.env.NEAR_NETWORK !== "testnet") throw new Error("Testnet only");
  const game = required("NEAR_GAME_ACCOUNT");
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  // A throwaway name under the same top-level account as the game.
  const id = `tmp-${randomBytes(6).toString("hex")}.${game.split(".").at(-1)}`;
  const keyPair = KeyPair.fromRandom("ed25519");
  const res = await fetch(required("NEAR_FAUCET_URL"), {
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
  console.log(`Moved faucet funds to ${game}. Balance now ${nearText(after)} NEAR.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
