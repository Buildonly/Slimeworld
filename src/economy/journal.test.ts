import { describe, expect, it } from "vitest";
import { BPS, TREASURY_FEE_BPS } from "./config";
import type { Move } from "./journal";
import { runTick } from "./tick";
import { createTown } from "./world";

describe("money journal", () => {
  it("explains every coin a slime gains or spends, like the town contract would", async () => {
    const w = createTown(8, 40);
    const start = new Map(Object.values(w.slimes).map((s) => [s.id, s.wallet]));
    const moves: Move[] = [];
    for (let i = 0; i < 24 * 5; i++) moves.push(...(await runTick(w)).moves);
    expect(moves.length).toBeGreaterThan(100);
    for (const s of Object.values(w.slimes)) {
      let expected = start.get(s.id)!;
      for (const m of moves) {
        const fee = m.kind === "sale" ? (m.amount * BigInt(TREASURY_FEE_BPS)) / BigInt(BPS) : 0n;
        if (m.to.kind === "slime" && m.to.id === s.id) expected += m.amount - fee;
        if (m.from.kind === "slime" && m.from.id === s.id) expected -= m.amount;
      }
      expect(s.wallet).toBe(expected);
    }
  });

  it("tags every slime spend with a category the contract understands", async () => {
    const w = createTown(8, 40);
    const moves: Move[] = [];
    for (let i = 0; i < 48; i++) moves.push(...(await runTick(w)).moves);
    for (const m of moves.filter((m) => m.from.kind === "slime" && m.kind === "spend")) {
      expect(["Food", "Toy", "Training", "Hat", "Material", "Race"]).toContain(m.category);
    }
  });
});
