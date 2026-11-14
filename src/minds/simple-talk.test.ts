import { describe, expect, it } from "vitest";
import { coins } from "@/economy/config";
import { createTown } from "@/economy/world";
import { simpleReply } from "./simple-talk";

describe("simple talk brain", () => {
  const world = createTown(9, 4);
  const slime = Object.values(world.slimes)[0]!;

  it("tells the truth about its coins", () => {
    slime.wallet = coins(123);
    expect(simpleReply(world, slime, "how much money do you have?").say).toContain("123");
  });
  it("says what to do next when asked", () => {
    slime.asleep = false;
    slime.job = null;
    slime.energy = 20;
    expect(simpleReply(world, slime, "where are we going to").say).toMatch(/Feed/);
  });
  it("never answers with nothing", () => {
    for (const q of ["", "???", "why is your head fuzzy", "tell me a story"]) expect(simpleReply(world, slime, q).say.length).toBeGreaterThan(5);
  });
});
