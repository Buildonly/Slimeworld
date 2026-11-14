/** JSON that keeps bigint money exact: bigints are stored as {"$b": "123"}. */
import type { World } from "./types";

export function toJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? { $b: v.toString() } : v));
}

export function fromJson<T>(text: string): T {
  return JSON.parse(text, (_k, v: unknown) => {
    if (v && typeof v === "object" && "$b" in v && Object.keys(v).length === 1) {
      const raw = (v as { $b: unknown }).$b;
      if (typeof raw === "string" && /^-?\d+$/.test(raw)) return BigInt(raw);
    }
    return v;
  }) as T;
}

export const worldToJson = (w: World) => toJson(w);
export function worldFromJson(text: string): World {
  const world = fromJson<World>(text);
  world.listings ??= [];
  // Worlds saved before these fields existed start them at zero.
  for (const s of Object.values(world.slimes)) {
    s.wins ??= 0;
    s.earnedTotal ??= 0n;
    s.cheers ??= 0;
  }
  return world;
}
