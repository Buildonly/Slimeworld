import { describe, expect, it } from "vitest";
import { playerAccountId } from "./player-account";

describe("playerAccountId", () => {
  it("makes a valid sub account id", () => {
    expect(playerAccountId("AbC_12-xyZ9", "game.testnet")).toBe("p-abc12xyz9.game.testnet");
  });
  it("rejects ids that would be too short", () => {
    expect(() => playerAccountId("a!", "game.testnet")).toThrow();
  });
});
