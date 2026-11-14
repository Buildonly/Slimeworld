/**
 * Try to cheat the town contract for real, on chain, and keep each refusal.
 * A test player, a second player and a slime are made fresh each run. Every
 * attempt is a real signed transaction; the contract's own error is stored
 * with the transaction hash in src/proofs/cheat-proofs.json, which ships
 * with the game and feeds the public Fair play page. Commit it after a run.
 *   pnpm proofs
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { Account, actions, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { PROOFS_FILE, type CheatProof } from "../src/proofs/cheat-proofs";
import { ITEMS, STARTER_COINS, STARTING_SHOPS, YOCTO_PER_BIT } from "../src/economy/config";
import { contractIds } from "../src/near/contracts";
import { accessKeyBytes, chainPrices, storageCost, withTopUp } from "../src/near/costs";
import { required } from "./script-env";

const GAS = teraToGas("30");
const yocto = (bits: bigint) => (bits * YOCTO_PER_BIT).toString();

type Attempt = { attempt: string; title: string; story: string; signer: Account; method: string; args: Record<string, unknown> };

/** The panic text from a failed outcome, e.g. "Smart contract panicked: Not enough coins". */
function refusal(failure: unknown): string {
  const text = JSON.stringify(failure);
  return /"ExecutionError":"([^"]+)"/.exec(text)?.[1] ?? text.slice(0, 200);
}

async function main() {
  const gameId = required("NEAR_GAME_ACCOUNT");
  const network = required("NEAR_NETWORK");
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  const game = new Account(gameId, provider, required("NEAR_GAME_PRIVATE_KEY") as KeyPairString);
  const owned = (id: string) => id === gameId || id.endsWith(`.${gameId}`);
  const { town } = contractIds(gameId);
  const p = await chainPrices(provider);
  const tag = randomBytes(3).toString("hex");

  // Each signer gets its own storage; gas money is topped up by the exact
  // amount the chain says it is short when it signs.
  const make = async (name: string) => {
    const kp = KeyPair.fromRandom("ed25519");
    const id = `${name}-${tag}.${gameId}`;
    await game.createAccount({ newAccountId: id, publicKey: kp.getPublicKey(), nearToTransfer: storageCost(p, accessKeyBytes(p)) });
    return new Account(id, provider, kp.toString() as KeyPairString);
  };
  const owner = await make("proof-owner");
  const stranger = await make("proof-stranger");
  const slime = await make("proof-slime");
  const keeper = `k-${STARTING_SHOPS[0]!.id}.${gameId}`;

  // The owner allows food only, with a daily limit of half the starter coins.
  const wallet = STARTER_COINS.slime;
  const dailyLimit = wallet / 2n;
  const food = ITEMS.find((i) => i.category === "Food")!;
  const hat = ITEMS.find((i) => i.category === "Hat")!;
  await withTopUp(game, owned, () => game.callFunction({ contractId: town, methodName: "register_slime", args: { slime_id: slime.accountId, owner_id: owner.accountId, rules: { daily_limit: yocto(dailyLimit), allowed: ["Food"], savings_target: "0" } }, gas: GAS }));
  await withTopUp(game, owned, () => game.callFunction({ contractId: town, methodName: "deposit", args: { account_id: slime.accountId }, deposit: BigInt(yocto(wallet)), gas: GAS }));

  const spend = (category: string, amount: bigint, memo: string) => ({ op: { from: slime.accountId, to: keeper, amount: yocto(amount), kind: { Spend: { category, emergency: false } }, memo } });
  const attempts: Attempt[] = [
    { attempt: "banned-item", title: "Buy something the owner banned", story: `The slime tries to buy a ${hat.title.toLowerCase()}, but its owner only allows food.`, signer: slime, method: "send", args: spend("Hat", hat.basePrice, hat.id) },
    { attempt: "over-limit", title: "Spend past the daily limit", story: `The slime tries to spend more on ${food.title.toLowerCase()} in one go than its owner allows in a day.`, signer: slime, method: "send", args: spend("Food", dailyLimit + 1n, food.id) },
    { attempt: "cash-out", title: "A slime cashes out on its own", story: "The slime tries to take its coins out of the town as NEAR.", signer: slime, method: "withdraw", args: { amount: yocto(1n) } },
    { attempt: "not-yours", title: "Spend someone else's coins", story: "A player signs a payment from a slime's wallet as if it were theirs.", signer: owner, method: "send", args: spend("Food", food.basePrice, food.id) },
    { attempt: "fake-game", title: "Pretend to be the game", story: "A player sends the game's own settle call to pay itself a prize.", signer: owner, method: "settle_batch", args: { ops: [{ from: gameId, to: owner.accountId, amount: yocto(wallet), kind: "Gift", memo: "free money" }] } },
    { attempt: "stranger-withdraw", title: "Take coins from someone's slime", story: "A stranger tries to move a slime's coins to its owner's purse.", signer: stranger, method: "owner_withdraw", args: { slime_id: slime.accountId, amount: yocto(1n) } },
  ];

  const proofs: CheatProof[] = [];
  for (const a of attempts) {
    const res = await withTopUp(game, owned, () => a.signer.signAndSendTransaction({ receiverId: town, actions: [actions.functionCall(a.method, a.args, GAS, 0n)], throwOnFailure: false }));
    const failure = (res.status as { Failure?: unknown }).Failure;
    if (!failure) throw new Error(`The contract did NOT refuse "${a.title}" (${res.transaction.hash}). Investigate before publishing.`);
    const error = refusal(failure);
    proofs.push({ attempt: a.attempt, title: a.title, story: a.story, error, txHash: res.transaction.hash, network, at: new Date().toISOString() });
    console.log(`BLOCKED  ${a.title}: ${error}`);
  }
  writeFileSync(PROOFS_FILE, JSON.stringify(proofs, null, 2) + "\n");
  console.log(`Saved ${proofs.length} proofs to ${PROOFS_FILE}. Commit it to publish them.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
