/**
 * Wrapped NEAR (wrap.near) for top ups: 1Click delivers wNEAR, which only
 * lands in accounts registered on the token. The game pays registration;
 * the player's account then unwraps it and puts it into the town as coins.
 */
import { Account, actions, teraToGas, type KeyPairString } from "near-api-js";
import { gameAccount, nearProvider } from "./client";
import { relayerAccount } from "./town-chain";

export const WNEAR = "wrap.near";
/** wrap.near's storage cost for one account (0.00125 NEAR). */
const STORAGE_DEPOSIT = 1_250_000_000_000_000_000_000n;
const GAS = teraToGas("50");

export async function isRegistered(accountId: string): Promise<boolean> {
  const v = await nearProvider().callFunction<{ total: string }>({ contractId: WNEAR, method: "storage_balance_of", args: { account_id: accountId } });
  return Boolean(v); // null when not registered
}

/** The game pays the player's wNEAR registration, once. */
export async function ensureRegistered(accountId: string): Promise<void> {
  if (await isRegistered(accountId)) return;
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  await game.callFunction({ contractId: WNEAR, methodName: "storage_deposit", args: { account_id: accountId, registration_only: true }, deposit: STORAGE_DEPOSIT, gas: GAS });
}

export async function wnearBalance(accountId: string): Promise<bigint> {
  return BigInt((await nearProvider().callFunction<string>({ contractId: WNEAR, method: "ft_balance_of", args: { account_id: accountId } })) ?? "0");
}

/**
 * Unwrap `amount` wNEAR in the player's account and deposit it into the town
 * as the player's coins. Signed by the player's account, gas paid by the
 * relayer (NEP-366), so the player sees no popup.
 */
export async function unwrapIntoTown(args: { accountId: string; fullKey: string; amount: bigint; town: string }): Promise<string> {
  const player = new Account(args.accountId, nearProvider(), args.fullKey as KeyPairString);
  const relayer = relayerAccount();
  const unwrap = await player.createSignedMetaTransaction({
    receiverId: WNEAR,
    actions: [actions.functionCall("near_withdraw", { amount: args.amount.toString() }, GAS, 1n)],
  });
  await relayer.relayMetaTransaction(unwrap.signedDelegate);
  const deposit = await player.createSignedMetaTransaction({
    receiverId: args.town,
    actions: [actions.functionCall("deposit", { account_id: args.accountId }, GAS, args.amount)],
  });
  const res = await relayer.relayMetaTransaction(deposit.signedDelegate);
  return res.transaction.hash;
}
