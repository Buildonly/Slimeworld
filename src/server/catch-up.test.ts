import { describe, expect, it } from "vitest";
import { CATCH_UP_TICKS_PER_CALL, TICK_SECONDS_NORMAL } from "@/economy/config";
import { dueTicks } from "./catch-up";

const at = new Date("2026-01-01T00:00:00Z");
const after = (ticks: number, extraMs = 0) => new Date(at.getTime() + ticks * TICK_SECONDS_NORMAL * 1000 + extraMs);

describe("town catch-up", () => {
  it("runs nothing before a tick is due", () => {
    expect(dueTicks(at, after(0, 500)).due).toBe(0);
  });
  it("runs every whole tick that is due and keeps the remainder", () => {
    const r = dueTicks(at, after(3, 1000));
    expect(r.due).toBe(3);
    expect(r.next.getTime()).toBe(after(3).getTime());
  });
  it("catches up a long quiet spell a slice at a time", () => {
    const r = dueTicks(at, after(CATCH_UP_TICKS_PER_CALL * 5));
    expect(r.due).toBe(CATCH_UP_TICKS_PER_CALL);
    expect(r.next.getTime()).toBe(after(CATCH_UP_TICKS_PER_CALL).getTime());
  });
});
