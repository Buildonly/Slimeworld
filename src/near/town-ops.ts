/**
 * Turn the engine's money journal into town contract operations for real
 * players and their slimes. Pure: no network, easy to test.
 *
 * - Slime spends and thoughts, and wages/prizes/sales/profit paid out, go in
 *   the operator's settle_batch. The contract re-checks each slime spend
 *   against the owner's rules.
 * - Anything the player pays (feeding, top ups, investing) is a meta
 *   transaction signed by the player's own account and relayed (NEP-366).
 */
import { GAME_DAYS_PER_REAL_DAY, YOCTO_PER_BIT, type ItemCategory } from "@/economy/config";
import type { Move, Party } from "@/economy/journal";
import type { Rules } from "@/economy/types";

export type ChainCategory = ItemCategory | "Race";
export type ContractOpKind = { Spend: { category: ChainCategory; emergency: boolean } } | "Thinking" | "Sale" | "Gift";
export type ContractOp = { from: string; to: string; amount: string; kind: ContractOpKind; memo: string | null };

export type ChainOpPayload =
  | { type: "settle"; op: ContractOp; slimeIds: string[]; playerIds: string[] }
  | { type: "meta"; playerId: string; method: "send" | "invest" | "set_rules"; args: Record<string, unknown> }
  | { type: "operator"; method: string; args: Record<string, unknown> };

/** Who is who on chain. Returns null for parties that only live in the simulation. */
export type AccountBook = {
  slime(id: string): string | null;
  player(id: string): string | null;
  shop(id: string): string;
  /** The game's own ledger account: treasury prizes, contest pools, outside clients, minds. */
  game: string;
};

export const toYocto = (bits: bigint): string => (bits * YOCTO_PER_BIT).toString();

function account(book: AccountBook, p: Party): string | null {
  switch (p.kind) {
    case "slime":
      return book.slime(p.id);
    case "player":
      return book.player(p.id);
    case "shop":
      return book.shop(p.id);
    default:
      return book.game;
  }
}

function isReal(book: AccountBook, p: Party): boolean {
  return (p.kind === "slime" && book.slime(p.id) !== null) || (p.kind === "player" && book.player(p.id) !== null);
}

export function moveToChainOp(move: Move, book: AccountBook): ChainOpPayload | null {
  if (!isReal(book, move.from) && !isReal(book, move.to)) return null;
  const from = account(book, move.from);
  const to = account(book, move.to);
  if (!from || !to) return null;
  const amount = toYocto(move.amount);
  const memo = move.memo.slice(0, 60);
  const ids = (k: "slime" | "player") => [move.from, move.to].filter((p) => p.kind === k).map((p) => (p as { id: string }).id);

  if (move.from.kind === "player") {
    if (move.kind === "invest" && move.to.kind === "shop") {
      return { type: "meta", playerId: move.from.id, method: "invest", args: { shop_id: move.to.id, investor_id: from, amount } };
    }
    return { type: "meta", playerId: move.from.id, method: "send", args: { op: { from, to, amount, kind: "Gift", memo } } };
  }

  let kind: ContractOpKind;
  if (move.from.kind === "slime") {
    if (move.kind === "think") kind = "Thinking";
    else if (move.kind === "spend" && move.category) kind = { Spend: { category: move.category, emergency: Boolean(move.emergency) } };
    else return null;
  } else {
    kind = move.kind === "sale" ? "Sale" : "Gift";
  }
  return { type: "settle", op: { from, to, amount, kind, memo }, slimeIds: ids("slime"), playerIds: ids("player") };
}

/** The owner's rules as the town contract stores them. */
export function chainRules(rules: Rules): { daily_limit: string; allowed: ChainCategory[]; savings_target: string } {
  const allowed: ChainCategory[] = [...rules.allowed];
  if (rules.allowedJobs.includes("race") || rules.allowedJobs.includes("puzzle")) allowed.push("Race");
  return {
    daily_limit: toYocto(rules.dailyLimit * BigInt(GAME_DAYS_PER_REAL_DAY)),
    allowed,
    savings_target: toYocto(rules.savingsTarget),
  };
}
