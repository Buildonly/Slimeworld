/** Small seeded random generator (mulberry32) so simulations repeat exactly. */
export type Rng = { state: number };

export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) | 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** True with the given chance in basis points. */
export function chance(rng: Rng, bps: number): boolean {
  return nextFloat(rng) * 10_000 < bps;
}

export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items[Math.floor(nextFloat(rng) * items.length)];
}

/** Pick an index by weight. Returns -1 when every weight is zero. */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = nextFloat(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return i;
  }
  return weights.length - 1;
}
