import { describe, expect, it } from "vitest";
import { coins } from "@/economy/config";
import type { Move } from "@/economy/journal";
import { chainRules, moveToChainOp, type AccountBook } from "./town-ops";

const book: AccountBook = {
  slime: (id) => (id === "real" ? "s-real.game.testnet" : null),
  player: (id) => (id === "abel" ? "p-abel.game.testnet" : null),
  shop: (id) => `k-${id}.game.testnet`,
  game: "game.testnet",
};
const move = (m: Partial<Move>): Move => ({ tick: 1, from: { kind: "town" }, to: { kind: "town" }, amount: coins(8), kind: "spend", memo: "x", ...m });

describe("journal to chain", () => {
  it("ignores money that only moves between simulated townsfolk", () => {
    expect(moveToChainOp(move({ from: { kind: "slime", id: "npc" }, to: { kind: "shop", id: "bakery" }, category: "Food" }), book)).toBeNull();
  });

  it("settles a real slime's food spend with its category for the rule check", () => {
    const op = moveToChainOp(move({ from: { kind: "slime", id: "real" }, to: { kind: "shop", id: "bakery" }, category: "Food", emergency: true }), book);
    expect(op).toEqual({
      type: "settle",
      op: { from: "s-real.game.testnet", to: "k-bakery.game.testnet", amount: (800n * 10n ** 19n).toString(), kind: { Spend: { category: "Food", emergency: true } }, memo: "x" },
      slimeIds: ["real"],
      playerIds: [],
    });
  });

  it("pays wages from the shop and thoughts to the game", () => {
    expect(moveToChainOp(move({ from: { kind: "shop", id: "toys" }, to: { kind: "slime", id: "real" }, kind: "wage" }), book)).toMatchObject({ op: { kind: "Gift", from: "k-toys.game.testnet" } });
    expect(moveToChainOp(move({ from: { kind: "slime", id: "real" }, to: { kind: "minds" }, kind: "think" }), book)).toMatchObject({ op: { kind: "Thinking", to: "game.testnet" } });
  });

  it("makes player payments gasless meta transactions signed by the player", () => {
    expect(moveToChainOp(move({ from: { kind: "player", id: "abel" }, to: { kind: "shop", id: "bakery" }, kind: "gift" }), book)).toMatchObject({
      type: "meta",
      playerId: "abel",
      method: "send",
      args: { op: { from: "p-abel.game.testnet", kind: "Gift" } },
    });
    expect(moveToChainOp(move({ from: { kind: "player", id: "abel" }, to: { kind: "shop", id: "icehut" }, kind: "invest" }), book)).toMatchObject({ method: "invest", args: { shop_id: "icehut" } });
  });

  it("registers daily limits at the same spending rate as the game", () => {
    const r = chainRules({ dailyLimit: coins(100), savingsTarget: coins(20), allowed: ["Food"], allowedJobs: ["race"] });
    expect(r.allowed).toEqual(["Food", "Race"]);
    expect(BigInt(r.daily_limit)).toBe(coins(100) * 60n * 10n ** 19n);
  });
});
