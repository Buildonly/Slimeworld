import { describe, expect, it } from "vitest";
import { runTick } from "./tick";
import { createTown } from "./world";
import { worldFromJson, worldToJson } from "./serialize";

describe("world serialization", () => {
  it("round trips a running town exactly, bigints included", async () => {
    const w = createTown(2, 20);
    for (let i = 0; i < 30; i++) await runTick(w);
    const back = worldFromJson(worldToJson(w));
    expect(back).toEqual(w);
    expect(typeof Object.values(back.slimes)[0]!.wallet).toBe("bigint");
  });
});
