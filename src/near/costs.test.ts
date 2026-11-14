import { describe, expect, it } from "vitest";
import { accessKeyBytes, gasCost, shortfallFrom, storageCost, type ChainPrices } from "./costs";
import { payoutNeeds } from "./town-chain";

const fee = { send_not_sir: 1, execution: 2 };
// Prices as a network might report them; the code reads the real ones live.
const prices: ChainPrices = {
  storagePerByte: 7n,
  gasPrice: 3n,
  accountBytes: 100n,
  recordBytes: 40n,
  fees: {
    storage_usage_config: { num_bytes_account: 100, num_extra_bytes_record: 40 },
    action_receipt_creation_config: fee,
    action_creation_config: {
      create_account_cost: fee,
      deploy_contract_cost: fee,
      deploy_contract_cost_per_byte: fee,
      function_call_cost: fee,
      function_call_cost_per_byte: fee,
      transfer_cost: fee,
      add_key_cost: { full_access_cost: fee },
    },
  },
};

describe("live NEAR costs", () => {
  it("sizes keys by NEAR's encoding", () => {
    expect(accessKeyBytes(prices)).toBe(40n + 33n + 9n);
    // allowance tag + receiver (4 + 6) + methods (4 + (4+4) + (4+3))
    expect(accessKeyBytes(prices, { receiverId: "town.x", methods: ["send", "pay"] })).toBe(40n + 33n + 9n + 1n + 10n + 4n + 8n + 7n);
  });
  it("prices storage and gas from the network's own numbers", () => {
    expect(storageCost(prices, 82n)).toBe((100n + 82n) * 7n);
    expect(gasCost(prices, 10n)).toBe(30n);
  });
  it("reads exact shortfalls from failed outcomes", () => {
    expect(shortfallFrom({ ActionError: { kind: { LackBalanceForState: { account_id: "town.g.near", amount: "123" } } } })).toEqual({ accountId: "town.g.near", amount: 123n });
    expect(shortfallFrom(new Error("something else"))).toBeNull();
  });
  it("covers only what the game's own ledgers pay out", () => {
    const op = (from: string, amount: string) => ({ from, to: "s", amount, kind: "Gift" as const, memo: null });
    const needs = payoutNeeds([op("k-a.g", "5"), op("k-a.g", "7"), op("s-x.g", "100"), op("g", "2")], (id) => id === "g" || id.startsWith("k-"));
    expect(Object.fromEntries(needs)).toEqual({ "k-a.g": 12n, g: 2n });
  });
});
