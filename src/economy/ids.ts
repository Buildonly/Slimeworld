import type { World } from "./types";

/** Short ids unique within a world. */
export function nextWorldId(world: World, prefix: string): string {
  world.nextId += 1;
  return `${prefix}${world.nextId.toString(36)}`;
}
