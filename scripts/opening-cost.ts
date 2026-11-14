/**
 * What opening the town and each new player costs on a network, worked out
 * live from that network's storage price, fee table and gas price, the
 * built contract sizes, and the wrapped NEAR token's own registration fee.
 * Nothing here is a guess or a constant: every figure comes from the chain
 * (or 1Click) at the moment it runs.
 */
import { readFileSync } from "node:fs";
import { teraToGas, type Provider } from "near-api-js";
import { z } from "zod";
import { ITEMS, STARTER_COINS, STARTING_SHOPS, YOCTO_PER_BIT, type Network } from "../src/economy/config";
import { accessKeyBytes, gasCost, receiptGas, storageCost, type ChainPrices } from "../src/near/costs";
import { PLAYER_KEY_METHODS } from "../src/near/town-chain";

export const CONTRACT_WASMS = ["slime_nft", "items_mt", "town"] as const;

export type Line = { what: string; storage: bigint; gasAtMost: bigint };
export type Cost = { opening: Line[]; perPlayer: Line[]; notes: string[] };

const sum = (lines: Line[]) => lines.reduce((t, l) => t + l.storage + l.gasAtMost, 0n);
export const total = sum;

function wasmBytes(name: string): number {
  return readFileSync(`contracts/target/near/${name}/${name}.wasm`).length;
}

/** Gas for one call to a contract, at most: fees plus everything attached (unused gas is refunded). */
function callGas(p: ChainPrices, attachedTgas: `${number}`, args: unknown): bigint {
  return gasCost(p, receiptGas(p, { call: { argBytes: Buffer.byteLength(JSON.stringify(args)), attachedGas: teraToGas(attachedTgas) } }));
}

/** A new account with one full key, created by its parent: storage plus the create receipt's gas. */
function newAccount(p: ChainPrices, what: string, extraBytes = 0n): Line {
  return {
    what,
    storage: storageCost(p, accessKeyBytes(p) + extraBytes),
    gasAtMost: gasCost(p, receiptGas(p, { createAccount: true, transfer: true, addFullKey: true })),
  };
}

export async function workOutCost(args: { prices: ChainPrices; provider: Provider; network: Network; gameId: string; wrappedNear: string | null }): Promise<Cost> {
  const p = args.prices;
  const town = `town.${args.gameId}`;
  const notes: string[] = [];

  const opening: Line[] = [newAccount(p, `Game account ${args.gameId}`)];
  for (const wasm of CONTRACT_WASMS) {
    const bytes = wasmBytes(wasm);
    opening.push(newAccount(p, `Contract account for ${wasm} (${bytes} bytes of code)`, BigInt(bytes)));
    opening.push({ what: `Deploy and set up ${wasm}`, storage: 0n, gasAtMost: gasCost(p, receiptGas(p, { deployBytes: bytes })) + callGas(p, "30", { owner_id: args.gameId }) });
  }
  opening.push({
    what: `Register ${ITEMS.length} item types`,
    storage: 0n,
    gasAtMost: ITEMS.reduce((t, i) => t + callGas(p, "10", { token_id: i.id, metadata: { title: i.title, description: i.description, category: i.category, media: null } }), callGas(p, "10", { account_id: town })),
  });
  opening.push(newAccount(p, `Relayer relayer.${args.gameId}`));
  opening.push({ what: `Open ${STARTING_SHOPS.length} shops`, storage: 0n, gasAtMost: STARTING_SHOPS.reduce((t, s) => t + callGas(p, "50", { shop_id: s.id, keeper_id: `k-${s.id}.${args.gameId}` }), 0n) });
  notes.push("Contract state (item types, shops, ledgers) is paid as it is written: the game tops each contract up by exactly what it is short.");

  const starter = STARTER_COINS[args.network];
  const playerKeys = accessKeyBytes(p) + accessKeyBytes(p, { receiverId: town, methods: PLAYER_KEY_METHODS });
  const perPlayer: Line[] = [
    { what: "Player account (its key and town-only key)", storage: storageCost(p, playerKeys), gasAtMost: gasCost(p, receiptGas(p, { createAccount: true, transfer: true, addFullKey: true })) },
    newAccount(p, "Slime account"),
    { what: "Mint the slime, register its rules, add the town-only key", storage: 0n, gasAtMost: callGas(p, "100", {}) * 3n },
    { what: `Starter coins (${(starter.slime + starter.purse) / 100n} coins, set in the economy config)`, storage: (starter.slime + starter.purse) * YOCTO_PER_BIT, gasAtMost: callGas(p, "100", {}) * 2n },
  ];
  if (args.wrappedNear) {
    const bounds = z.object({ min: z.string().regex(/^\d+$/) }).parse(await args.provider.callFunction({ contractId: args.wrappedNear, method: "storage_balance_bounds", args: {} }));
    perPlayer.push({ what: `Wrapped NEAR registration on ${args.wrappedNear} (first top up only)`, storage: BigInt(bounds.min), gasAtMost: callGas(p, "50", { account_id: args.gameId, registration_only: true }) });
  } else notes.push("Wrapped NEAR registration is left out: no 1Click token list on this network.");
  notes.push("Gas is an upper bound at today's gas price: unused gas is refunded.");
  return { opening, perPlayer, notes };
}
