/**
 * Network calls to the town, slime NFT and items contracts. Only the chain
 * worker uses these; game actions go through the outbox first.
 *
 * No NEAR amount is fixed here: new accounts get exactly their storage at
 * the live price, and when a game-owned account (a contract, the relayer, a
 * shop keeper's ledger) runs short, the game sends just the missing amount.
 */
import { Account, actions, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { serverEnv } from "@/lib/env";
import { gameAccount, livePrices, nearProvider, ownedByGame } from "./client";
import { contractIds } from "./contracts";
import { accessKeyBytes, storageCost, withTopUp } from "./costs";
import type { ContractOp } from "./town-ops";

type RpcTransactionResponse = Awaited<ReturnType<Account["callFunctionRaw"]>>;

/** Methods a player's town key may call. No deposits, no other contracts. */
export const PLAYER_KEY_METHODS = ["send", "set_rules", "invest", "owner_withdraw"];
const GAS = teraToGas("100");
const SETTLE_GAS = teraToGas("300");

export function txHash(res: RpcTransactionResponse): string {
  return res.transaction.hash;
}

function requireGame(): Account {
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  return game;
}

/** Run a call; if a game-owned account was short of NEAR, top it up by the shortfall and retry. */
function funded<T>(run: () => Promise<T>): Promise<T> {
  const game = requireGame();
  return withTopUp(game, ownedByGame(game.accountId), run);
}

export function relayerAccount(): Account {
  const env = serverEnv();
  if (!env.NEAR_RELAYER_ACCOUNT || !env.NEAR_RELAYER_PRIVATE_KEY) throw new Error("Relayer is not configured");
  return new Account(env.NEAR_RELAYER_ACCOUNT, nearProvider(), env.NEAR_RELAYER_PRIVATE_KEY as KeyPairString);
}

/** Relay a signed meta transaction; the relayer is topped up if it can't cover the gas. */
export function relay(signedDelegate: Parameters<Account["relayMetaTransaction"]>[0]): ReturnType<Account["relayMetaTransaction"]> {
  return funded(() => relayerAccount().relayMetaTransaction(signedDelegate));
}

export function ids() {
  return contractIds(requireGame().accountId);
}

/** Wait until a new account's key is visible on the RPC node. */
async function waitForAccount(accountId: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    try {
      await nearProvider().viewAccount({ accountId });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 750));
    }
  }
  throw new Error(`Account ${accountId} never appeared`);
}

/** Create the slime's own account, mint its NFT to the player, register its rules on the town. */
export async function createSlimeOnChain(args: {
  accountId: string;
  privateKey: string;
  tokenId: string;
  ownerAccountId: string;
  name: string;
  traits: Record<string, unknown>;
  rules: { daily_limit: string; allowed: string[]; savings_target: string };
  starterYocto: string;
}): Promise<string[]> {
  const game = requireGame();
  const c = ids();
  const hashes: string[] = [];
  const pub = KeyPair.fromString(args.privateKey as KeyPairString).getPublicKey();
  try {
    await nearProvider().viewAccount({ accountId: args.accountId });
  } catch {
    const p = await livePrices();
    hashes.push(txHash(await game.createAccount({ newAccountId: args.accountId, publicKey: pub, nearToTransfer: storageCost(p, accessKeyBytes(p)) })));
    await waitForAccount(args.accountId);
  }
  const mint = await funded(() =>
    game.callFunctionRaw({
      contractId: c.nft,
      methodName: "mint_slime",
      args: { token_id: args.tokenId, owner_id: args.ownerAccountId, slime_account: args.accountId, name: args.name, traits_json: JSON.stringify(args.traits) },
      gas: GAS,
    }),
  );
  hashes.push(txHash(mint));
  const reg = await funded(() =>
    game.callFunctionRaw({ contractId: c.town, methodName: "register_slime", args: { slime_id: args.accountId, owner_id: args.ownerAccountId, rules: args.rules }, gas: GAS }),
  );
  hashes.push(txHash(reg));
  const dep = await funded(() =>
    game.callFunctionRaw({ contractId: c.town, methodName: "deposit", args: { account_id: args.accountId }, deposit: BigInt(args.starterYocto), gas: GAS }),
  );
  hashes.push(txHash(dep));
  return hashes;
}

/** Give a player their starter coins and a town-only key the game signs with. */
export async function setupPlayerOnChain(args: { accountId: string; fullKey: string; fcPublicKey: string; starterYocto: string }): Promise<string[]> {
  const game = requireGame();
  const player = new Account(args.accountId, nearProvider(), args.fullKey as KeyPairString);
  const { signedDelegate } = await player.createSignedMetaTransaction({
    receiverId: args.accountId,
    actions: [actions.addFunctionCallAccessKey(KeyPair.fromString(args.fcPublicKey as KeyPairString).getPublicKey(), ids().town, PLAYER_KEY_METHODS)],
  });
  const added = await relay(signedDelegate);
  const dep = await funded(() =>
    game.callFunctionRaw({ contractId: ids().town, methodName: "deposit", args: { account_id: args.accountId }, deposit: BigInt(args.starterYocto), gas: GAS }),
  );
  return [txHash(added), txHash(dep)];
}

/** A player's own call to the town, signed with their town-only key and paid for by the relayer (NEP-366). */
export async function relayPlayerCall(args: { accountId: string; fcKey: string; method: string; args: Record<string, unknown> }): Promise<string> {
  const player = new Account(args.accountId, nearProvider(), args.fcKey as KeyPairString);
  const { signedDelegate } = await player.createSignedMetaTransaction({
    receiverId: ids().town,
    actions: [actions.functionCall(args.method, args.args, GAS, 0n)],
  });
  const res = await relay(signedDelegate);
  const failure = (res.status as { Failure?: unknown }).Failure;
  if (failure) throw new Error(`Town said no: ${JSON.stringify(failure).slice(0, 160)}`);
  return txHash(res);
}

export async function townBalance(accountId: string): Promise<bigint> {
  const v = await nearProvider().callFunction<string>({ contractId: ids().town, method: "balance_of", args: { account_id: accountId } });
  return BigInt(v ?? "0");
}

/**
 * Coins the game's own ledgers (shop keepers, the game) pay out in this
 * batch. The game deposits only what each is missing, right before it pays,
 * instead of keeping a fixed float.
 */
export function payoutNeeds(ops: ContractOp[], isGameLedger: (accountId: string) => boolean): Map<string, bigint> {
  const needs = new Map<string, bigint>();
  for (const op of ops) if (isGameLedger(op.from)) needs.set(op.from, (needs.get(op.from) ?? 0n) + BigInt(op.amount));
  return needs;
}

async function coverPayouts(ops: ContractOp[]): Promise<void> {
  const game = requireGame();
  const isGameLedger = (id: string) => id === game.accountId || (id.startsWith("k-") && id.endsWith(`.${game.accountId}`));
  for (const [accountId, need] of payoutNeeds(ops, isGameLedger)) {
    const have = await townBalance(accountId);
    if (have >= need) continue;
    await funded(() => game.callFunctionRaw({ contractId: ids().town, methodName: "deposit", args: { account_id: accountId }, deposit: need - have, gas: GAS }));
  }
}

/** Settle up to a batch of operations; the contract checks each slime's rules and returns ok per op. */
export async function settleBatch(ops: ContractOp[]): Promise<{ hash: string; results: boolean[] }> {
  await coverPayouts(ops);
  const res = await funded(() => requireGame().callFunctionRaw({ contractId: ids().town, methodName: "settle_batch", args: { ops }, gas: SETTLE_GAS }));
  const success = (res.status as { SuccessValue?: string }).SuccessValue;
  const results = success ? (JSON.parse(Buffer.from(success, "base64").toString("utf8")) as boolean[]) : [];
  return { hash: txHash(res), results };
}

export async function operatorCall(method: string, args: Record<string, unknown>): Promise<string> {
  return txHash(await funded(() => requireGame().callFunctionRaw({ contractId: ids().town, methodName: method, args, gas: GAS })));
}
