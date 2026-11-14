import type { Slime } from "./types";

const MAX_MEMORY = 12;

/** Add a line to a slime's short life log. */
export function remember(slime: Slime, line: string): void {
  slime.memory.push(line);
  if (slime.memory.length > MAX_MEMORY) slime.memory.splice(0, slime.memory.length - MAX_MEMORY);
}
