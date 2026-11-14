/**
 * Talking to the $GOO contract (goo.<game>). The game only reports what
 * happened; the contract decides every amount. Keepers burn their own GOO
 * with a call signed by their account and relayed, so no popup and no gas.
 */
import { Account, actions, teraToGas, type KeyPairString } from "near-api-js";
import { z } from "zod";
import { gameAccount, nearProvider, ownedByGame } from "./client";
import { withTopUp } from "./costs";
import { ids, relay, relayFailure } from "./town-chain";

const GAS = teraToGas("30");
const statsSchema = z.object({ total_supply: z.string(), pool: z.string(), burned: z.string(), rewarded: z.string(), reports: z.number() });
const rulesSchema = z.object({ care_reward: z.string(), win_reward: z.string(), rescue_burn: z.string(), item_prices: z.record(z.string(), z.string()) });

/** Report one happening. Returns the transaction hash, or null if it was already counted. */
export async function reportGoo(happening: "Care" | "Win" | "Rescue", eventId: string, accountId: string): Promise<string | null> {
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  try {
    const res = await withTopUp(game, ownedByGame(game.accountId), () =>
      game.callFunctionRaw({ contractId: ids().goo, methodName: "report", args: { event_id: eventId, happening, account_id: accountId }, gas: GAS }),
    );
    return res.transaction.hash;
  } catch (err) {
    if (String(err instanceof Error ? err.message : err).includes("Already recorded")) return null;
    throw err;
  }
}

export async function gooBalance(accountId: string): Promise<bigint> {
  return BigInt((await nearProvider().callFunction<string>({ contractId: ids().goo, method: "ft_balance_of", args: { account_id: accountId } })) ?? "0");
}

export async function gooStats() {
  return statsSchema.parse(await nearProvider().callFunction({ contractId: ids().goo, method: "stats", args: {} }));
}

export async function gooRulesLive() {
  return rulesSchema.parse(await nearProvider().callFunction({ contractId: ids().goo, method: "get_rules", args: {} }));
}

/** The keeper burns their own GOO for an item, signed by their account and relayed. */
export async function burnGooFor(args: { accountId: string; fullKey: string; itemId: string }): Promise<string> {
  const player = new Account(args.accountId, nearProvider(), args.fullKey as KeyPairString);
  const { signedDelegate } = await player.createSignedMetaTransaction({ receiverId: ids().goo, actions: [actions.functionCall("burn_for", { item_id: args.itemId }, GAS, 0n)] });
  const res = await relay(signedDelegate);
  const failure = relayFailure(res);
  if (failure) throw new Error(/Not enough GOO/.test(JSON.stringify(failure)) ? "Not enough GOO yet." : "The burn was refused.");
  return res.transaction.hash;
}
