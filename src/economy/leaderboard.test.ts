import { describe, expect, it } from "vitest";
import { coins } from "./config";
import { ensurePlayer, hatch } from "./actions";
import { leaderboards, myPlace } from "./leaderboard";
import { createTown } from "./world";

function town() {
  const world = createTown(7, 12);
  ensurePlayer(world, "real-player", "Ada's keeper", coins(10));
  const mine = hatch(world, "real-player", "Blub", "green", coins(5000));
  mine.wins = 3;
  mine.cheers = 2;
  mine.earnedTotal = coins(1);
  return { world, mine };
}

describe("leaderboards", () => {
  it("ranks the richest slimes and marks the viewer's own", () => {
    const { world, mine } = town();
    const richest = leaderboards(world, "real-player").find((b) => b.id === "richest")!;
    expect(richest.entries[0]).toMatchObject({ rank: 1, id: mine.id, name: "Blub", sub: "Ada's keeper", mine: true });
    expect(richest.entries.length).toBeLessThanOrEqual(10);
  });
  it("only lists slimes that have actually won or been cheered", () => {
    const { world, mine } = town();
    const boards = leaderboards(world, null);
    expect(boards.find((b) => b.id === "champions")!.entries.map((e) => e.id)).toEqual([mine.id]);
    expect(boards.find((b) => b.id === "cheered")!.entries[0]).toMatchObject({ value: "2", unit: "cheers", mine: false });
  });
  it("counts a keeper's purse plus their slimes, and never shows emails", () => {
    const { world } = town();
    const keepers = leaderboards(world, "real-player").find((b) => b.id === "keepers")!;
    expect(keepers.entries[0]).toMatchObject({ name: "Ada's keeper", value: (coins(10) + coins(5000)).toString(), mine: true });
  });
  it("finds the viewer's place outside the top ten", () => {
    const { world, mine } = town();
    mine.wallet = 0n;
    const place = myPlace(world, "real-player", "richest")!;
    expect(place.of).toBe(Object.keys(world.slimes).length);
    expect(place.rank).toBeGreaterThan(1);
  });
});
