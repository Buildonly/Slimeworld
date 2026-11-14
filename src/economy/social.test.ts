import { describe, expect, it } from "vitest";
import { coins, GIFT_MAX } from "./config";
import { ensurePlayer, hatch } from "./actions";
import { cheer, giftTo } from "./social";
import { createTown } from "./world";

function town() {
  const world = createTown(3, 6);
  ensurePlayer(world, "real-a", "Ada's keeper", coins(100));
  ensurePlayer(world, "real-b", "Bo's keeper", coins(100));
  const theirs = hatch(world, "real-b", "Wob", "blue", coins(10));
  const mine = hatch(world, "real-a", "Blub", "green", coins(10));
  world.journal = [];
  return { world, theirs, mine };
}

describe("social", () => {
  it("cheers another player's slime, makes it happier and tells the town", () => {
    const { world, theirs } = town();
    theirs.joy = 50;
    const r = cheer(world, "real-a", theirs.id);
    expect(r.ok).toBe(true);
    expect(theirs.cheers).toBe(1);
    expect(theirs.joy).toBeGreaterThan(50);
    expect(world.events.at(-1)).toMatchObject({ kind: "cheered", text: "Ada's keeper cheered for Wob." });
  });
  it("won't let you cheer your own slime", () => {
    const { world, mine } = town();
    expect(cheer(world, "real-a", mine.id).ok).toBe(false);
  });
  it("gifts coins from the purse to a friend's slime, through the money journal", () => {
    const { world, theirs } = town();
    const r = giftTo(world, "real-a", theirs.id, coins(20));
    expect(r.ok).toBe(true);
    expect(world.players["real-a"]!.wallet).toBe(coins(80));
    expect(theirs.wallet).toBe(coins(30));
    expect(world.journal).toEqual([expect.objectContaining({ from: { kind: "player", id: "real-a" }, to: { kind: "slime", id: theirs.id }, amount: coins(20), kind: "gift" })]);
  });
  it("refuses gifts over the cap, beyond the purse, or to your own slime", () => {
    const { world, theirs, mine } = town();
    expect(giftTo(world, "real-a", theirs.id, GIFT_MAX + 1n).ok).toBe(false);
    world.players["real-a"]!.wallet = coins(1);
    expect(giftTo(world, "real-a", theirs.id, coins(2)).ok).toBe(false);
    expect(giftTo(world, "real-a", mine.id, coins(1)).ok).toBe(false);
    const townSlime = Object.values(world.slimes).find((s) => s.ownerId === null)!;
    expect(giftTo(world, "real-a", townSlime.id, coins(1)).ok).toBe(false);
    expect(world.journal).toEqual([]);
  });
});
