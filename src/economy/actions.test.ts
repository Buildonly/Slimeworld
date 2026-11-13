import { describe, expect, it } from "vitest";
import { coins } from "./config";
import { ensurePlayer, feed, giveItem, hatch, play, sendToJob, setRules, topUpSlime } from "./actions";
import { runTick } from "./tick";
import { createTown } from "./world";

async function town() {
  const w = createTown(12, 30);
  for (let i = 0; i < 3; i++) await runTick(w);
  w.journal = [];
  const player = ensurePlayer(w, "real1", "Abel");
  const slime = hatch(w, player.id, "Blub", "pink");
  return { w, player, slime };
}

describe("player actions", () => {
  it("feeds a slime with the player's coins and journals it for the chain", async () => {
    const { w, player, slime } = await town();
    slime.energy = 30;
    const before = player.wallet;
    const r = feed(w, player.id, slime.id);
    expect(r.ok).toBe(true);
    expect(slime.energy).toBeGreaterThan(30);
    expect(player.wallet).toBeLessThan(before);
    expect(w.journal.at(-1)).toMatchObject({ kind: "gift", from: { kind: "player", id: player.id } });
  });

  it("refuses to touch someone else's slime", async () => {
    const { w, slime } = await town();
    ensurePlayer(w, "intruder", "Eve");
    expect(feed(w, "intruder", slime.id).ok).toBe(false);
    expect(play(w, "intruder", slime.id).ok).toBe(false);
    expect(topUpSlime(w, "intruder", slime.id, coins(1)).ok).toBe(false);
  });

  it("won't give materials or spend coins the player doesn't have", async () => {
    const { w, player, slime } = await town();
    expect(giveItem(w, player.id, slime.id, "iron").ok).toBe(false);
    player.wallet = 0n;
    expect(giveItem(w, player.id, slime.id, "cake")).toEqual({ ok: false, message: "Not enough coins. Top up first!" });
  });

  it("sends a slime to the best job and wakes a sleeping slime when topped up", async () => {
    const { w, player, slime } = await town();
    slime.energy = 90;
    const job = sendToJob(w, player.id, slime.id);
    expect(job.ok).toBe(true);
    expect(slime.job).not.toBeNull();
    slime.asleep = true;
    expect(topUpSlime(w, player.id, slime.id, coins(10)).ok).toBe(true);
    expect(slime.asleep).toBe(false);
  });

  it("saves only known categories and job kinds", async () => {
    const { w, player, slime } = await town();
    setRules(w, player.id, slime.id, { dailyLimit: coins(50), savingsTarget: coins(10), allowed: ["Food", "Bogus" as never], allowedJobs: ["race", "heist" as never] });
    expect(slime.rules).toEqual({ dailyLimit: coins(50), savingsTarget: coins(10), allowed: ["Food"], allowedJobs: ["race"] });
  });
});
