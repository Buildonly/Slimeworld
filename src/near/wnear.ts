/**
 * Wrapped NEAR for top ups: 1Click delivers wrapped NEAR, which only lands
 * in accounts registered on the token. The game pays registration (the
 * token's own minimum, read live); the player's account then unwraps it and
 * puts it into the town as coins. The token contract is the one 1Click lists.
 */
import { Account, actions, teraToGas, type KeyPairString } from "near-api-js";
import { z } from "zod";
import { wrappedNearContract } from "@/topup/assets";
import { gameAccount, nearProvider } from "./client";
import { relay } from "./town-chain";

const GAS = teraToGas("50");
const boundsSchema = z.object({ min: z.string().regex(/^\d+$/) });

export async function isRegistered(accountId: string): Promise<boolean> {
  const v = await nearProvider().callFunction<{ total: string }>({ contractId: await wrappedNearContract(), method: "storage_balance_of", args: { account_id: accountId } });
  return Boolean(v); // null when not registered
}

/** The game pays the account's wrapped NEAR registration, once, at the token's own minimum. */
export async function ensureRegistered(accountId: string): Promise<void> {
  if (await isRegistered(accountId)) return;
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  const token = await wrappedNearContract();
  const bounds = boundsSchema.parse(await nearProvider().callFunction({ contractId: token, method: "storage_balance_bounds", args: {} }));
  await game.callFunction({ contractId: token, methodName: "storage_deposit", args: { account_id: accountId, registration_only: true }, deposit: BigInt(bounds.min), gas: GAS });
}

export async function wnearBalance(accountId: string): Promise<bigint> {
  return BigInt((await nearProvider().callFunction<string>({ contractId: await wrappedNearContract(), method: "ft_balance_of", args: { account_id: accountId } })) ?? "0");
}

/**
 * Unwrap `amount` in the player's account and deposit it into the town as
 * the player's coins. Signed by the player's account, gas paid by the
 * relayer (NEP-366), so the player sees no popup.
 */
export async function unwrapIntoTown(args: { accountId: string; fullKey: string; amount: bigint; town: string }): Promise<string> {
  const player = new Account(args.accountId, nearProvider(), args.fullKey as KeyPairString);
  const unwrap = await player.createSignedMetaTransaction({
    receiverId: await wrappedNearContract(),
    actions: [actions.functionCall("near_withdraw", { amount: args.amount.toString() }, GAS, 1n)],
  });
  await relay(unwrap.signedDelegate);
  const deposit = await player.createSignedMetaTransaction({
    receiverId: args.town,
    actions: [actions.functionCall("deposit", { account_id: args.accountId }, GAS, args.amount)],
  });
  const res = await relay(deposit.signedDelegate);
  return res.transaction.hash;
}
