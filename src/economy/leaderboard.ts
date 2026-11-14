/**
 * Town rankings, worked out from the town itself. Pure: no network, easy to
 * test. Names only, never emails: a player shows as their public keeper name.
 */
import type { Bits } from "./config";
import type { World } from "./types";

export type BoardId = "richest" | "earners" | "champions" | "cheered" | "keepers" | "shops";
export type BoardEntry = {
  rank: number;
  id: string;
  name: string;
  /** Who it belongs to: a keeper name, "Town slime", or the shop keeper. */
  sub: string;
  colour: string | null;
  /** Coins as bits (string) or a plain count. */
  value: string;
  unit: "coins" | "wins" | "cheers";
  mine: boolean;
};
export type Board = { id: BoardId; title: string; blurb: string; entries: BoardEntry[] };

export const BOARD_SIZE = 10;

function rank<T>(items: T[], score: (t: T) => bigint, size: number): T[] {
  return [...items].sort((a, b) => {
    const d = score(b) - score(a);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  }).slice(0, size);
}

export function leaderboards(world: World, viewerId: string | null, size = BOARD_SIZE): Board[] {
  const slimes = Object.values(world.slimes);
  const ownerName = (ownerId: string | null) => (ownerId ? (world.players[ownerId]?.name ?? "A keeper") : "Town slime");
  const slimeBoard = (id: BoardId, title: string, blurb: string, unit: BoardEntry["unit"], score: (s: (typeof slimes)[number]) => bigint): Board => ({
    id,
    title,
    blurb,
    entries: rank(slimes.filter((s) => score(s) > 0n), score, size).map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.name,
      sub: ownerName(s.ownerId),
      colour: s.colour,
      value: score(s).toString(),
      unit,
      mine: viewerId !== null && s.ownerId === viewerId,
    })),
  });

  // Keepers: real players by everything they hold, purse plus their slimes.
  const keeperWorth = new Map<string, Bits>();
  for (const p of Object.values(world.players)) keeperWorth.set(p.id, p.wallet);
  for (const s of slimes) if (s.ownerId && keeperWorth.has(s.ownerId)) keeperWorth.set(s.ownerId, keeperWorth.get(s.ownerId)! + s.wallet);
  const keepers = rank([...keeperWorth.entries()].filter(([, v]) => v > 0n), ([, v]) => v, size);

  const shops = rank(Object.values(world.shops).filter((s) => s.open), (s) => s.wallet, size);

  return [
    slimeBoard("richest", "Richest slimes", "Coins in their wallet right now.", "coins", (s) => s.wallet),
    slimeBoard("earners", "Hardest workers", "Coins earned since hatching.", "coins", (s) => s.earnedTotal),
    slimeBoard("champions", "Race champions", "Races and puzzle contests won.", "wins", (s) => BigInt(s.wins)),
    slimeBoard("cheered", "Most loved", "Cheers from other players.", "cheers", (s) => BigInt(s.cheers)),
    {
      id: "keepers",
      title: "Top keepers",
      blurb: "Players by everything they and their slimes hold.",
      entries: keepers.map(([id, v], i) => ({ rank: i + 1, id, name: world.players[id]!.name, sub: `${Object.values(world.slimes).filter((s) => s.ownerId === id).length} slime(s)`, colour: null, value: v.toString(), unit: "coins", mine: id === viewerId })),
    },
    {
      id: "shops",
      title: "Busiest shops",
      blurb: "Open shops by the coins in their till.",
      entries: shops.map((s, i) => ({ rank: i + 1, id: s.id, name: s.name, sub: `Kept by ${s.keeper}`, colour: null, value: s.wallet.toString(), unit: "coins", mine: false })),
    },
  ];
}

/** Where the viewer's best slime stands on a board, even outside the top. */
export function myPlace(world: World, viewerId: string, board: BoardId): { rank: number; of: number } | null {
  const score = (s: World["slimes"][string]) => (board === "richest" ? s.wallet : board === "earners" ? s.earnedTotal : board === "champions" ? BigInt(s.wins) : BigInt(s.cheers));
  if (!["richest", "earners", "champions", "cheered"].includes(board)) return null;
  const all = rank(Object.values(world.slimes), score, Number.MAX_SAFE_INTEGER);
  const i = all.findIndex((s) => s.ownerId === viewerId);
  return i >= 0 ? { rank: i + 1, of: all.length } : null;
}
