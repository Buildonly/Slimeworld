import { describe, expect, it } from "vitest";
import { nearbySpot, townLayout, WALK_RADIUS } from "./layout";
import { newMover, step, towards } from "./movement";

const shops = ["bakery", "pantry", "icehut", "toys", "school", "smithy"];

describe("town layout", () => {
  it("places every shop, the job board, the races and the fountain", () => {
    const { spots } = townLayout(shops);
    expect(spots.filter((s) => s.kind === "shop").map((s) => s.id)).toEqual(shops);
    expect(spots.map((s) => s.kind)).toEqual(expect.arrayContaining(["jobs", "races", "fountain"]));
  });

  it("finds the nearest spot within reach", () => {
    const { spots } = townLayout(shops);
    const bakery = spots.find((s) => s.id === "bakery")!;
    expect(nearbySpot(spots, { x: bakery.pos.x * 0.8, z: bakery.pos.z * 0.8 })?.id).toBe("bakery");
    expect(nearbySpot(spots, { x: 0, z: 5.2 })).toBeNull();
  });
});

describe("moving a slime", () => {
  it("hops forward, speeds up and turns to face where it goes", () => {
    let m = newMover({ x: 0, z: 5 });
    for (let i = 0; i < 60; i++) m = step(m, { x: 1, z: 0 }, 1 / 60, []);
    expect(m.pos.x).toBeGreaterThan(1);
    expect(m.speed).toBeGreaterThan(3);
    expect(Math.sin(m.heading)).toBeGreaterThan(0.9);
  });

  it("stops when there is no input", () => {
    let m = { ...newMover(), speed: 4 };
    for (let i = 0; i < 60; i++) m = step(m, { x: 0, z: 0 }, 1 / 60, []);
    expect(m.speed).toBe(0);
  });

  it("can't walk through the fountain or out of town", () => {
    let m = newMover({ x: 0, z: 4 });
    for (let i = 0; i < 240; i++) m = step(m, { x: 0, z: -1 }, 1 / 60, [{ x: 0, z: 0, r: 1.7 }]);
    expect(Math.hypot(m.pos.x, m.pos.z)).toBeGreaterThanOrEqual(1.7 + 0.5);
    let n = newMover({ x: 0, z: 0 });
    for (let i = 0; i < 600; i++) n = step(n, { x: 1, z: 0 }, 1 / 60, []);
    expect(Math.hypot(n.pos.x, n.pos.z)).toBeLessThanOrEqual(WALK_RADIUS + 1e-9);
  });

  it("steers to a tapped point and settles there", () => {
    let m = newMover({ x: 0, z: 5 });
    const goal = { x: 6, z: 8 };
    for (let i = 0; i < 400; i++) m = step(m, towards(m.pos, goal), 1 / 60, []);
    expect(Math.hypot(m.pos.x - goal.x, m.pos.z - goal.z)).toBeLessThan(0.6);
  });
});

import { guide } from "./guide";
import type { SlimeDto, TownDto } from "@/lib/dto";

describe("the guide", () => {
  const { spots } = townLayout(["bakery", "toys"]);
  const slime: SlimeDto = {
    id: "s1", name: "Mochi", colour: "gold", personality: "greedy", state: "fine", lonely: false, energy: 80, joy: 70, size: 1, wallet: "5000",
    skills: { speed: 20, smarts: 20, charm: 20 }, job: null, memory: [], ageDays: 1,
    rules: { dailyLimit: "12000", savingsTarget: "2000", allowed: ["Food"], allowedJobs: ["delivery", "race"] }, spentToday: "0", chain: null,
  };
  const shop = (id: string, closed = false) => ({ id, name: id === "bakery" ? "Bun's Bakery" : "Bop's Toys", keeper: "K", personality: "fair", status: (closed ? "closed" : "open") as "open" | "closed", wallet: "0", prices: id === "bakery" ? [{ item: "berries", title: "Berries", price: "800", base: "800", reason: "", stock: 5 }] : [], buys: [], margin: "normal", hoard: null, investors: 0 });
  const town: TownDto = { clock: { tick: 1, day: 1, hour: 1, season: "calm", seasonTitle: "Calm" }, population: 0, shops: [shop("bakery"), shop("toys")], slimes: [], events: [], jobs: [{ kind: "delivery", wage: "1400", shop: null }], contests: [] };

  it("sends a hungry slime to the cheapest open food stall", () => {
    expect(guide({ ...slime, energy: 20 }, town, spots)).toMatchObject({ spotId: "bakery" });
  });
  it("asks for a pat when lonely and for food when asleep", () => {
    expect(guide({ ...slime, lonely: true }, town, spots)?.button).toBe("pat");
    expect(guide({ ...slime, state: "asleep" }, town, spots)?.button).toBe("feed");
  });
  it("points at the job board when coins run low, and stays quiet when all is well", () => {
    expect(guide({ ...slime, wallet: "3000" }, town, spots)?.spotId).toBe("jobs");
    expect(guide(slime, town, spots)).toBeNull();
  });
});

describe("town layout spacing", () => {
  it("keeps the race ground away from the job board, and spawns in the open", async () => {
    const { spawnPoint } = await import("./layout");
    const { spots, solids } = townLayout(["a", "b", "c", "d", "e", "f"]);
    const jobs = spots.find((s) => s.kind === "jobs")!;
    const races = spots.find((s) => s.kind === "races")!;
    expect(Math.hypot(jobs.pos.x - races.pos.x, jobs.pos.z - races.pos.z)).toBeGreaterThan(4);
    const start = spawnPoint();
    for (const s of solids) expect(Math.hypot(start.x - s.x, start.z - s.z)).toBeGreaterThan(s.r + 0.6);
  });
});

describe("first view", () => {
  it("has no lantern or stall between the start point and the camera behind it", async () => {
    const { spawnPoint } = await import("./layout");
    const { solids } = townLayout(["a", "b", "c", "d", "e", "f"]);
    const p = spawnPoint();
    const len = Math.hypot(p.x, p.z);
    const back = { x: p.x / len, z: p.z / len }; // camera sits behind, away from the fountain
    for (const s of solids) {
      const t = (s.x - p.x) * back.x + (s.z - p.z) * back.z;
      if (t <= 0 || t > 7.5) continue;
      const off = Math.hypot(p.x + back.x * t - s.x, p.z + back.z * t - s.z);
      expect(off).toBeGreaterThan(s.r + 0.5);
    }
  });
});
