/**
 * Where everything stands in the town. Pure data, so the 3D scene, the
 * minimap, collisions and interaction prompts all agree. Units are metres,
 * x/z on the ground, the fountain at the origin.
 */

export type Vec2 = { x: number; z: number };
export type Spot = {
  id: string;
  kind: "shop" | "jobs" | "races" | "fountain";
  pos: Vec2;
  /** Which way the front faces (radians, 0 = +z). */
  facing: number;
  /** How close the slime must be to use it. */
  reach: number;
};
export type Solid = Vec2 & { r: number };
export type Prop = { kind: "House" | "Tree" | "Bush" | "Flowers" | "Rock" | "Lantern" | "Fence" | "Bench" | "Crate" | "Barrel"; pos: Vec2; rot: number; tint?: number };

export const PLAZA_RADIUS = 14;
/** The slime can wander a little past the plaza onto the meadow. */
export const WALK_RADIUS = 19;
const STALL_RING = 9;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const at = (angle: number, r: number): Vec2 => ({ x: Math.sin(angle) * r, z: Math.cos(angle) * r });

/** Stalls around the fountain, facing inwards; the job board and race arch fill two gaps. */
export function townLayout(shopIds: string[]): { spots: Spot[]; solids: Solid[]; props: Prop[] } {
  const spots: Spot[] = [{ id: "fountain", kind: "fountain", pos: { x: 0, z: 0 }, facing: 0, reach: 3.2 }];
  const slots = shopIds.length + 2;
  shopIds.forEach((id, i) => {
    const a = ((i + 1) / slots) * Math.PI * 2;
    spots.push({ id, kind: "shop", pos: at(a, STALL_RING), facing: a + Math.PI, reach: 3 });
  });
  const ja = 0;
  spots.push({ id: "jobs", kind: "jobs", pos: at(ja, STALL_RING), facing: ja + Math.PI, reach: 3 });
  // Slot 0 is the job board, the last slot the race ground, shops in between.
  const ra = ((slots - 1) / slots) * Math.PI * 2;
  // The arch spans the lane into the race ground, facing the fountain.
  spots.push({ id: "races", kind: "races", pos: at(ra, STALL_RING + 4), facing: ra + Math.PI, reach: 3.5 });

  const solids: Solid[] = [{ x: 0, z: 0, r: 1.7 }];
  for (const s of spots) if (s.kind === "shop") solids.push({ ...s.pos, r: 1.4 });
  const jobs = spots.find((s) => s.kind === "jobs");
  if (jobs) solids.push({ ...jobs.pos, r: 0.9 });

  const rand = rng(42);
  const props: Prop[] = [];
  // Houses ring the plaza, with gaps for paths.
  for (let i = 0; i < 14; i++) {
    if (i % 7 === 3) continue;
    const a = (i / 14) * Math.PI * 2 + 0.11;
    const pos = at(a, 21 + rand() * 2);
    props.push({ kind: "House", pos, rot: a + Math.PI, tint: Math.floor(rand() * 4) });
    solids.push({ ...pos, r: 2.4 });
  }
  // Lanterns and benches on the inner ring, between stalls.
  for (let i = 0; i < slots; i++) {
    const a = ((i + 0.5) / slots) * Math.PI * 2;
    props.push({ kind: "Lantern", pos: at(a, 5.2), rot: 0 });
    solids.push({ ...at(a, 5.2), r: 0.25 });
    // Benches, but none on the lane into the race ground (that's the opening view).
    const nearRaceLane = Math.abs(((a + 0.25 - ra + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.6;
    if (i % 2 === 0 && !nearRaceLane) {
      props.push({ kind: "Bench", pos: at(a + 0.25, 4), rot: -a });
      solids.push({ ...at(a + 0.25, 4), r: 0.7 });
    }
  }
  // Greenery on the meadow, never on the plaza or the walking ring.
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = 15.5 + rand() * 4.5;
    const kind = (["Tree", "Bush", "Flowers", "Rock", "Bush", "Flowers"] as const)[i % 6]!;
    const pos = at(a, r);
    props.push({ kind, pos, rot: rand() * Math.PI * 2 });
    if (kind === "Tree" || kind === "Rock") solids.push({ ...pos, r: kind === "Tree" ? 0.6 : 0.7 });
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2;
    props.push({ kind: (["Crate", "Barrel"] as const)[i % 2]!, pos: at(a, 12 + rand()), rot: rand() * 6 });
  }
  return { spots, solids, props };
}

/**
 * Where a visit starts: on the lane from the race ground to the fountain,
 * the one line with nothing between the slime and the camera behind it.
 */
export function spawnPoint(shopCount: number): Vec2 {
  const slots = shopCount + 2;
  return at(((slots - 1) / slots) * Math.PI * 2, 3.6);
}

/** The spot the slime is close enough to use, nearest first. */
export function nearbySpot(spots: Spot[], p: Vec2): Spot | null {
  let best: Spot | null = null;
  let bestD = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
    if (d <= s.reach && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}
