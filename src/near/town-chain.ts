/**
 * Network calls to the town, slime NFT and items contracts. Only the chain
 * worker uses these; game actions go through the outbox first.
 */
import { Account, actions, KeyPair, teraToGas, type KeyPairString } from "near-api-js";

type RpcTransactionResponse = Awaited<ReturnType<Account["callFunctionRaw"]>>;
import { PLAYER_ACCOUNT_FUNDING_YOCTO } from "@/economy/config";
import { serverEnv } from "@/lib/env";
import { gameAccount, nearProvider } from "./client";
import { contractIds } from "./contracts";
import type { ContractOp } from "./town-ops";

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

export function relayerAccount(): Account {
  const env = serverEnv();
  if (!env.NEAR_RELAYER_ACCOUNT || !env.NEAR_RELAYER_PRIVATE_KEY) throw new Error("Relayer is not configured");
  return new Account(env.NEAR_RELAYER_ACCOUNT, nearProvider(), env.NEAR_RELAYER_PRIVATE_KEY as KeyPairString);
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
    hashes.push(txHash(await game.createAccount({ newAccountId: args.accountId, publicKey: pub, nearToTransfer: PLAYER_ACCOUNT_FUNDING_YOCTO })));
    await waitForAccount(args.accountId);
  }
  const mint = await game.callFunctionRaw({
    contractId: c.nft,
    methodName: "mint_slime",
    args: { token_id: args.tokenId, owner_id: args.ownerAccountId, slime_account: args.accountId, name: args.name, traits_json: JSON.stringify(args.traits) },
    gas: GAS,
  });
  hashes.push(txHash(mint));
  const reg = await game.callFunctionRaw({
    contractId: c.town,
    methodName: "register_slime",
    args: { slime_id: args.accountId, owner_id: args.ownerAccountId, rules: args.rules },
    gas: GAS,
  });
  hashes.push(txHash(reg));
  const dep = await game.callFunctionRaw({ contractId: c.town, methodName: "deposit", args: { account_id: args.accountId }, deposit: BigInt(args.starterYocto), gas: GAS });
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
  const added = await relayerAccount().relayMetaTransaction(signedDelegate);
  const dep = await game.callFunctionRaw({ contractId: ids().town, methodName: "deposit", args: { account_id: args.accountId }, deposit: BigInt(args.starterYocto), gas: GAS });
  return [txHash(added), txHash(dep)];
}

/** A player's own call to the town, signed with their town-only key and paid for by the relayer (NEP-366). */
export async function relayPlayerCall(args: { accountId: string; fcKey: string; method: string; args: Record<string, unknown> }): Promise<string> {
  const player = new Account(args.accountId, nearProvider(), args.fcKey as KeyPairString);
  const { signedDelegate } = await player.createSignedMetaTransaction({
    receiverId: ids().town,
    actions: [actions.functionCall(args.method, args.args, GAS, 0n)],
  });
  const res = await relayerAccount().relayMetaTransaction(signedDelegate);
  const failure = (res.status as { Failure?: unknown }).Failure;
  if (failure) throw new Error(`Town said no: ${JSON.stringify(failure).slice(0, 160)}`);
  return txHash(res);
}

/** Settle up to a batch of operations; the contract checks each slime's rules and returns ok per op. */
export async function settleBatch(ops: ContractOp[]): Promise<{ hash: string; results: boolean[] }> {
  const res = await requireGame().callFunctionRaw({ contractId: ids().town, methodName: "settle_batch", args: { ops }, gas: SETTLE_GAS });
  const success = (res.status as { SuccessValue?: string }).SuccessValue;
  const results = success ? (JSON.parse(Buffer.from(success, "base64").toString("utf8")) as boolean[]) : [];
  return { hash: txHash(res), results };
}

export async function operatorCall(method: string, args: Record<string, unknown>): Promise<string> {
  return txHash(await requireGame().callFunctionRaw({ contractId: ids().town, methodName: method, args, gas: GAS }));
}

export async function townBalance(accountId: string): Promise<bigint> {
  const v = await nearProvider().callFunction<string>({ contractId: ids().town, method: "balance_of", args: { account_id: accountId } });
  return BigInt(v ?? "0");
}
