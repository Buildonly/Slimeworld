/**
 * Moving your slime: input in, new position out. Slimes hop rather than
 * walk, so speed comes in bursts. Pure, so it can be tested.
 */
import { WALK_RADIUS, type Solid, type Vec2 } from "./layout";

export type Mover = { pos: Vec2; heading: number; speed: number; hop: number };
export type Input = { x: number; z: number }; // desired direction, length 0..1

export const MAX_SPEED = 4.2; // metres per second
const ACCEL = 10;
const FRICTION = 8;
const BODY_RADIUS = 0.55;

export function newMover(pos: Vec2 = { x: 0, z: 4 }): Mover {
  return { pos: { ...pos }, heading: Math.PI, speed: 0, hop: 0 };
}

/** Steer towards a target (tap or click to move). Stops when close. */
export function towards(from: Vec2, to: Vec2 | null): Input {
  if (!to) return { x: 0, z: 0 };
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.4) return { x: 0, z: 0 };
  const k = Math.min(1, d / 1.5) / d;
  return { x: dx * k, z: dz * k };
}

/** Advance one frame. `solids` are things the slime bumps into. */
export function step(m: Mover, input: Input, dt: number, solids: Solid[], moodSpeed = 1): Mover {
  const mag = Math.min(1, Math.hypot(input.x, input.z));
  const target = mag * MAX_SPEED * moodSpeed;
  const speed = m.speed + (target > m.speed ? Math.min(ACCEL * dt, target - m.speed) : -Math.min(FRICTION * dt, m.speed - target));
  let heading = m.heading;
  if (mag > 0.05) {
    const want = Math.atan2(input.x, input.z);
    let diff = want - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    heading += diff * Math.min(1, dt * 12);
  }
  let x = m.pos.x + Math.sin(heading) * speed * dt;
  let z = m.pos.z + Math.cos(heading) * speed * dt;
  // Stay in town.
  const r = Math.hypot(x, z);
  if (r > WALK_RADIUS) {
    x *= WALK_RADIUS / r;
    z *= WALK_RADIUS / r;
  }
  // Slide around anything solid.
  for (const s of solids) {
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    const min = s.r + BODY_RADIUS;
    if (d < min && d > 1e-6) {
      x = s.x + (dx / d) * min;
      z = s.z + (dz / d) * min;
    }
  }
  const hop = speed > 0.2 ? (m.hop + dt * (1.6 + speed * 0.5)) % 1 : m.hop > 0 ? Math.min(1, m.hop + dt * 3) % 1 : 0;
  return { pos: { x, z }, heading, speed, hop };
}
