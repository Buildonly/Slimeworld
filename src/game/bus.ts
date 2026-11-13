/**
 * Shared game state between the 3D scene and the HUD (joystick, minimap,
 * prompts). Changes go through methods, every frame, without React renders.
 */
import { nearbySpot, type Solid, type Spot, type Vec2 } from "./layout";
import { newMover, step, towards, type Mover } from "./movement";

export class GameBus {
  input: Vec2 = { x: 0, z: 0 };
  target: Vec2 | null = null;
  mover: Mover;
  yaw = 0;
  zoom = 1;
  nearby: string | null = null;
  private listeners = new Set<(spot: Spot | null) => void>();

  constructor(start?: Vec2) {
    this.mover = newMover(start);
    this.yaw = Math.atan2(-this.mover.pos.x, -this.mover.pos.z); // start facing the fountain
  }

  /** Joystick or keys, relative to the camera. Cancels any tap target. */
  setInput(x: number, z: number) {
    this.input = { x, z };
    if (Math.hypot(x, z) > 0.05) this.target = null;
  }

  setTarget(p: Vec2 | null) {
    this.target = p;
  }

  /** Turn the camera around the slime (drag) and zoom (pinch or wheel). */
  look(dYaw: number, dZoom = 0) {
    this.yaw += dYaw;
    this.zoom = Math.min(1.8, Math.max(0.6, this.zoom + dZoom));
  }

  onNearby(fn: (spot: Spot | null) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Advance the player one frame. Returns whether it is moving. */
  advance(dt: number, solids: Solid[], spots: Spot[], moodSpeed: number): boolean {
    const { x, z } = this.input;
    const world = { x: x * Math.cos(this.yaw) + z * Math.sin(this.yaw), z: -x * Math.sin(this.yaw) + z * Math.cos(this.yaw) };
    const input = Math.hypot(x, z) > 0.05 ? world : towards(this.mover.pos, this.target);
    this.mover = step(this.mover, input, dt, solids, moodSpeed);
    if (this.target && this.mover.speed < 0.05 && Math.hypot(this.target.x - this.mover.pos.x, this.target.z - this.mover.pos.z) < 0.7) this.target = null;
    const spot = nearbySpot(spots, this.mover.pos);
    if ((spot?.id ?? null) !== this.nearby) {
      this.nearby = spot?.id ?? null;
      for (const fn of this.listeners) fn(spot);
    }
    return this.mover.speed > 0.3;
  }
}
