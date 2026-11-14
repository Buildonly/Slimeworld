import type { Vec2 } from "./layout";

/**
 * Where a town point sits on the small map, seen the way the camera sees it:
 * straight ahead is up and your right is right. The camera looks along
 * (sin yaw, cos yaw), and three.js puts screen right at (-cos yaw, sin yaw).
 */
export function mapPoint(yaw: number, p: Vec2): { right: number; ahead: number } {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { right: -p.x * fz + p.z * fx, ahead: p.x * fx + p.z * fz };
}

/** Canvas turn for the "you" arrow (drawn pointing up) so it points where the slime faces. */
export const arrowTurn = (yaw: number, heading: number): number => yaw - heading;
