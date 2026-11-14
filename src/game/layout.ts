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

/** The open Town Square around the fountain, where townsfolk mostly wander. */
export const PLAZA_RADIUS = 9;
/** How far the slime can roam: the square, the paths and the districts. */
export const WALK_RADIUS = 33;

/** A stone path from the square to a district, drawn on the ground. */
export type Path = { from: Vec2; to: Vec2; width: number };
/** A big floating sign over a place, so nobody has to guess where things are. */
export type Label = { text: string; pos: Vec2; height: number };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const at = (angle: number, r: number): Vec2 => ({ x: Math.sin(angle) * r, z: Math.cos(angle) * r });

/** Where each district starts, from the square: north, east, south. */
const RACE_GROUND: Vec2 = { x: 0, z: 19 };
const JOB_BOARD: Vec2 = { x: 17, z: 0 };
const MARKET_START = -14;
const MARKET_STEP = 6.5;
const MARKET_SIDE = 4.6;

/**
 * A town you can read at a glance: the Town Square with the fountain in the
 * middle; three stone paths lead out to the Race ground (north), the Job
 * board (east) and Market Street (south), where the shops face each other
 * along the road. Big signs float over each place. Houses and trees stay
 * out on the edge, off the paths.
 */
export function townLayout(shopIds: string[]): { spots: Spot[]; solids: Solid[]; props: Prop[]; paths: Path[]; labels: Label[] } {
  const spots: Spot[] = [{ id: "fountain", kind: "fountain", pos: { x: 0, z: 0 }, facing: 0, reach: 3.4 }];
  shopIds.forEach((id, i) => {
    const left = i % 2 === 0;
    const pos = { x: left ? -MARKET_SIDE : MARKET_SIDE, z: MARKET_START - Math.floor(i / 2) * MARKET_STEP };
    // Each stall faces the street.
    spots.push({ id, kind: "shop", pos, facing: left ? Math.PI / 2 : -Math.PI / 2, reach: 3.2 });
  });
  spots.push({ id: "jobs", kind: "jobs", pos: JOB_BOARD, facing: -Math.PI / 2, reach: 3.2 });
  spots.push({ id: "races", kind: "races", pos: RACE_GROUND, facing: Math.PI, reach: 3.6 });
  const marketEnd = MARKET_START - Math.max(0, Math.ceil(shopIds.length / 2) - 1) * MARKET_STEP;

  const paths: Path[] = [
    { from: { x: 0, z: -PLAZA_RADIUS + 1 }, to: { x: 0, z: marketEnd - 4 }, width: 4.2 },
    { from: { x: PLAZA_RADIUS - 1, z: 0 }, to: { x: JOB_BOARD.x + 1, z: 0 }, width: 3.4 },
    { from: { x: 0, z: PLAZA_RADIUS - 1 }, to: { x: 0, z: RACE_GROUND.z + 2 }, width: 3.4 },
  ];
  const labels: Label[] = [
    { text: "🏁 Race ground", pos: RACE_GROUND, height: 5.2 },
    { text: "💼 Job board", pos: JOB_BOARD, height: 4.2 },
    // Down the street, behind the start view, so it never sits in front of your slime.
    { text: "🛒 Market Street", pos: { x: 0, z: MARKET_START - 3 }, height: 4.6 },
  ];

  const solids: Solid[] = [{ x: 0, z: 0, r: 1.7 }];
  for (const s of spots) if (s.kind === "shop") solids.push({ ...s.pos, r: 1.4 });
  solids.push({ ...JOB_BOARD, r: 0.9 });

  const rand = rng(42);
  const props: Prop[] = [];
  // Is a point on (or right next to) a path or the square? Keep it clear.
  const onWay = (p: Vec2, pad: number) =>
    Math.hypot(p.x, p.z) < PLAZA_RADIUS + pad ||
    paths.some((w) => {
      const dx = w.to.x - w.from.x;
      const dz = w.to.z - w.from.z;
      const len2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((p.x - w.from.x) * dx + (p.z - w.from.z) * dz) / len2));
      return Math.hypot(p.x - (w.from.x + dx * t), p.z - (w.from.z + dz * t)) < w.width / 2 + pad;
    });
  const blocked = (p: Vec2, r: number) => onWay(p, r + 1.5) || solids.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < s.r + r + 1);

  // Houses: behind the market stalls, and around the edge of town.
  for (const s of spots.filter((x) => x.kind === "shop")) {
    const pos = { x: s.pos.x * 2.1, z: s.pos.z };
    props.push({ kind: "House", pos, rot: s.facing, tint: Math.floor(rand() * 4) });
    solids.push({ ...pos, r: 2.4 });
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const pos = at(a, 29 + rand() * 2);
    if (blocked(pos, 2.4)) continue;
    props.push({ kind: "House", pos, rot: a + Math.PI, tint: Math.floor(rand() * 4) });
    solids.push({ ...pos, r: 2.4 });
  }
  // Lanterns only where paths leave the square: they mark the way out.
  for (const w of paths) {
    const d = { x: w.from.x / PLAZA_RADIUS, z: w.from.z / PLAZA_RADIUS };
    for (const side of [-1, 1]) {
      const pos = { x: w.from.x * 1.08 + d.z * side * (w.width / 2 + 0.6), z: w.from.z * 1.08 - d.x * side * (w.width / 2 + 0.6) };
      props.push({ kind: "Lantern", pos, rot: 0 });
      solids.push({ ...pos, r: 0.25 });
    }
  }
  // Greenery between districts, never on a path.
  for (let i = 0; i < 60 && props.filter((p) => p.kind !== "House" && p.kind !== "Lantern").length < 24; i++) {
    const pos = at(rand() * Math.PI * 2, 12 + rand() * 18);
    const kind = (["Tree", "Bush", "Flowers", "Tree", "Flowers", "Rock"] as const)[i % 6]!;
    const r = kind === "Tree" ? 0.6 : 0.7;
    if (blocked(pos, r + 1)) continue;
    props.push({ kind, pos, rot: rand() * Math.PI * 2 });
    if (kind === "Tree" || kind === "Rock") solids.push({ ...pos, r });
  }
  return { spots, solids, props, paths, labels };
}

/**
 * Where a visit starts: at the south edge of the square, looking north over
 * the fountain toward the race ground, with Market Street behind you.
 */
export function spawnPoint(): Vec2 {
  return { x: 0, z: -5.5 };
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
