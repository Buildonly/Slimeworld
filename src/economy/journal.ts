/**
 * The money journal: every coin movement that touches a slime or a player,
 * with who paid whom and why. The server turns entries for real players into
 * town contract operations, so the chain stays the record of their money.
 */
import type { Bits, ItemCategory } from "./config";
import type { World } from "./types";

export type Party =
  | { kind: "slime"; id: string }
  | { kind: "player"; id: string }
  | { kind: "shop"; id: string }
  /** Treasury prizes, contest pools and outside clients (guard jobs). */
  | { kind: "town" }
  /** NEAR AI Cloud, paid per thought. */
  | { kind: "minds" };

export type MoveKind = "spend" | "think" | "wage" | "prize" | "sale" | "gift" | "invest" | "profit";

export type Move = {
  tick: number;
  from: Party;
  to: Party;
  amount: Bits;
  kind: MoveKind;
  /** For spends: what was bought, so the town contract can check the owner's rules. */
  category?: ItemCategory | "Race";
  /** Food bought by a starving slime may dip below its savings target. */
  emergency?: boolean;
  memo: string;
};

export function record(world: World, move: Omit<Move, "tick">): void {
  if (move.amount <= 0n) return;
  world.journal.push({ tick: world.tick, ...move });
}

export const slimeParty = (id: string): Party => ({ kind: "slime", id });
export const playerParty = (id: string): Party => ({ kind: "player", id });
export const shopParty = (id: string): Party => ({ kind: "shop", id });
