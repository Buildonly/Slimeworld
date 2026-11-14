/**
 * What things cost on NEAR, read live from the chain. No NEAR amount is
 * written down anywhere in the game: storage and gas prices come from the
 * network's protocol config and gas price, and every account is funded with
 * exactly what it needs, topped up only when it runs short.
 */
import type { Account, Provider } from "near-api-js";
import { LackBalanceForStateActionError, NotEnoughBalanceError } from "near-api-js/rpc-errors";
import { z } from "zod";

const fee = z.object({ send_not_sir: z.number(), execution: z.number() });
const protocolSchema = z.object({
  runtime_config: z.object({
    storage_amount_per_byte: z.string(),
    transaction_costs: z.object({
      storage_usage_config: z.object({ num_bytes_account: z.number(), num_extra_bytes_record: z.number() }),
      action_receipt_creation_config: fee,
      action_creation_config: z.object({
        create_account_cost: fee,
        deploy_contract_cost: fee,
        deploy_contract_cost_per_byte: fee,
        function_call_cost: fee,
        function_call_cost_per_byte: fee,
        transfer_cost: fee,
        add_key_cost: z.object({ full_access_cost: fee }),
      }),
    }),
  }),
});
const gasPriceSchema = z.object({ gas_price: z.string() });

export type ChainPrices = {
  /** yocto per byte of stored state */
  storagePerByte: bigint;
  /** yocto per gas unit, right now */
  gasPrice: bigint;
  accountBytes: bigint;
  recordBytes: bigint;
  fees: z.infer<typeof protocolSchema>["runtime_config"]["transaction_costs"];
};

/** Live storage and gas prices from the connected network. */
export async function chainPrices(provider: Provider): Promise<ChainPrices> {
  const config = protocolSchema.parse(await provider.experimental_protocolConfig({ finality: "final" }));
  const gas = gasPriceSchema.parse(await provider.viewGasPrice());
  const tc = config.runtime_config.transaction_costs;
  return {
    storagePerByte: BigInt(config.runtime_config.storage_amount_per_byte),
    gasPrice: BigInt(gas.gas_price),
    accountBytes: BigInt(tc.storage_usage_config.num_bytes_account),
    recordBytes: BigInt(tc.storage_usage_config.num_extra_bytes_record),
    fees: tc,
  };
}

/**
 * Stored size of one access key, by NEAR's encoding: the record overhead,
 * the ed25519 public key (1 + 32 bytes), and the borsh access key value:
 * nonce (8) + permission tag (1), plus for a function call key the
 * allowance option, receiver id and method names.
 */
export function accessKeyBytes(p: ChainPrices, fnCall?: { receiverId: string; methods: string[] }): bigint {
  let value = 8 + 1;
  if (fnCall) {
    value += 1; // allowance: None
    value += 4 + Buffer.byteLength(fnCall.receiverId);
    value += 4 + fnCall.methods.reduce((n, m) => n + 4 + Buffer.byteLength(m), 0);
  }
  return p.recordBytes + 33n + BigInt(value);
}

/** NEAR an account must hold for its own storage: the account record, its keys and any code. */
export function storageCost(p: ChainPrices, extraBytes: bigint): bigint {
  return (p.accountBytes + extraBytes) * p.storagePerByte;
}

/** Gas fees for one receipt with the given actions, sent and executed. */
export function receiptGas(p: ChainPrices, parts: { createAccount?: boolean; transfer?: boolean; addFullKey?: boolean; deployBytes?: number; call?: { argBytes: number; attachedGas: bigint } }): bigint {
  const a = p.fees.action_creation_config;
  const both = (f: { send_not_sir: number; execution: number }) => BigInt(f.send_not_sir + f.execution);
  let gas = both(p.fees.action_receipt_creation_config);
  if (parts.createAccount) gas += both(a.create_account_cost);
  if (parts.transfer) gas += both(a.transfer_cost);
  if (parts.addFullKey) gas += both(a.add_key_cost.full_access_cost);
  if (parts.deployBytes !== undefined) gas += both(a.deploy_contract_cost) + both(a.deploy_contract_cost_per_byte) * BigInt(parts.deployBytes);
  if (parts.call) gas += both(a.function_call_cost) + both(a.function_call_cost_per_byte) * BigInt(parts.call.argBytes) + parts.call.attachedGas;
  return gas;
}

/** NEAR for that much gas at today's price. */
export const gasCost = (p: ChainPrices, gas: bigint): bigint => gas * p.gasPrice;

/** NEAR an account holds beyond what its storage locks up. */
export async function freeBalance(provider: Provider, p: ChainPrices, accountId: string): Promise<bigint> {
  const v = await provider.viewAccount({ accountId });
  return BigInt(v.amount) - BigInt(v.storage_usage) * p.storagePerByte;
}

/** Send `accountId` only what it is missing to have `need` free. Returns what was sent. */
export async function topUpTo(funder: Account, p: ChainPrices, accountId: string, need: bigint): Promise<bigint> {
  const free = await freeBalance(funder.provider, p, accountId);
  if (free >= need) return 0n;
  const send = need - free;
  await funder.transfer({ receiverId: accountId, amount: send });
  return send;
}

/**
 * Pull "account X needs N more yocto" out of a NEAR error or a failed
 * outcome: storage (LackBalanceForState) or a signer short of gas money
 * (NotEnoughBalance). The chain states the exact amount; nothing is guessed.
 */
export function shortfallFrom(err: unknown): { accountId: string; amount: bigint } | null {
  if (err instanceof LackBalanceForStateActionError) return { accountId: err.accountId, amount: err.amount };
  if (err instanceof NotEnoughBalanceError) return { accountId: err.signerId, amount: err.cost - err.balance };
  let text: string;
  try {
    text = JSON.stringify(err, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)) ?? "";
  } catch {
    return null;
  }
  const state = /"LackBalanceForState":\{"account_id":"([^"]+)","amount":"(\d+)"\}/.exec(text);
  return state ? { accountId: state[1]!, amount: BigInt(state[2]!) } : null;
}

/** A raw outcome whose receipts failed for lack of storage money still "succeeds" as a call. */
function failedOutcome(result: unknown): unknown {
  const status = (result as { status?: { Failure?: unknown } } | null)?.status;
  return status && typeof status === "object" && "Failure" in status ? status.Failure : null;
}

/**
 * Run a chain call; if an account the game owns was short of NEAR, send it
 * exactly the missing amount and try once more.
 */
export async function withTopUp<T>(funder: Account, owned: (accountId: string) => boolean, run: () => Promise<T>): Promise<T> {
  const fixable = (s: { accountId: string; amount: bigint } | null): s is { accountId: string; amount: bigint } => Boolean(s && s.amount > 0n && owned(s.accountId));
  let short: { accountId: string; amount: bigint } | null;
  try {
    const result = await run();
    const failure = failedOutcome(result);
    short = failure ? shortfallFrom(failure) : null;
    if (!fixable(short)) return result;
  } catch (err) {
    short = shortfallFrom(err);
    if (!fixable(short)) throw err;
  }
  await funder.transfer({ receiverId: short.accountId, amount: short.amount });
  return run();
}
