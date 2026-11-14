/**
 * The one way to change the town: lock it, load it, change it, save it,
 * and queue the chain writes its money journal implies. Ticks and player
 * actions both go through here, so they never step on each other.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { chainOps, decisions, gameEvents, players, prices, slimeAccounts, worlds } from "@/db/schema";
import { TICKS_PER_DAY } from "@/economy/config";
import type { Move } from "@/economy/journal";
import { worldFromJson, worldToJson } from "@/economy/serialize";
import type { Decision, GameEvent, World } from "@/economy/types";
import { createTown } from "@/economy/world";
import { gameAccount } from "@/near/client";
import { moveToChainOp, type AccountBook, type ChainOpPayload } from "@/near/town-ops";

export const MAIN_WORLD = "main";
/** The live town starts with this many slimes (docs/SETUP.md: 50 AI slimes). */
export const STARTING_SLIMES = 50;

export type Changes = { decisions: Decision[]; events: GameEvent[]; moves: Move[]; dayEnded?: boolean };
export const noChanges = (): Changes => ({ decisions: [], events: [], moves: [] });

export async function loadWorld(db: Db, id = MAIN_WORLD): Promise<World> {
  const [row] = await db.select().from(worlds).where(eq(worlds.id, id));
  if (row) {
    const w = worldFromJson(JSON.stringify(row.state));
    w.journal ??= [];
    return w;
  }
  const world = createTown(Date.now() % 2_147_483_647, STARTING_SLIMES);
  await db.insert(worlds).values({ id, tick: world.tick, state: JSON.parse(worldToJson(world)) }).onConflictDoNothing();
  return world;
}

/** Account ids of the real players and slimes in this world. */
export async function accountBook(db: Db, worldId: string): Promise<AccountBook | null> {
  const game = gameAccount();
  if (!game) return null;
  const slimes = await db.select({ slimeId: slimeAccounts.slimeId, accountId: slimeAccounts.accountId }).from(slimeAccounts).where(eq(slimeAccounts.worldId, worldId));
  const ps = await db.select({ id: players.id, account: players.nearAccountId }).from(players).where(isNotNull(players.nearAccountId));
  const slimeMap = new Map(slimes.map((s) => [s.slimeId, s.accountId]));
  const playerMap = new Map(ps.map((p) => [p.id, p.account ?? ""]));
  return {
    slime: (id) => slimeMap.get(id) ?? null,
    player: (id) => playerMap.get(id) || null,
    shop: (id) => `k-${id}.${game.accountId}`,
    game: game.accountId,
  };
}

/** Shops closing and reopening are mirrored on the town contract too. */
function eventToChainOp(e: GameEvent): ChainOpPayload | null {
  if (e.kind === "shop_closed" && e.shopId) return { type: "operator", method: "close_shop", args: { shop_id: e.shopId } };
  return null;
}

async function persist(db: Db, id: string, world: World, changes: Changes): Promise<void> {
  await db.update(worlds).set({ tick: world.tick, state: JSON.parse(worldToJson(world)), updatedAt: new Date() }).where(eq(worlds.id, id));
  for (let i = 0; i < changes.decisions.length; i += 500) {
    await db.insert(decisions).values(changes.decisions.slice(i, i + 500).map((d) => ({ worldId: id, ...d })));
  }
  if (changes.events.length) await db.insert(gameEvents).values(changes.events.map((e) => ({ worldId: id, ...e })));
  if (changes.dayEnded) {
    const day = Math.floor(world.tick / TICKS_PER_DAY);
    const rows = Object.values(world.shops).flatMap((shop) =>
      Object.entries(shop.prices).map(([itemId, p]) => ({ worldId: id, shopId: shop.id, itemId, day, price: p.price, reason: p.reason })),
    );
    if (rows.length) await db.insert(prices).values(rows).onConflictDoNothing();
  }
  const book = id === MAIN_WORLD ? await accountBook(db, id) : null;
  if (book) {
    // A real player's slime won a contest: $GOO for its keeper.
    const wins = changes.events.flatMap((e): ChainOpPayload[] => {
      const owner = e.kind === "contest" && e.slimeId ? world.slimes[e.slimeId]?.ownerId : null;
      return owner && book.player(owner) ? [{ type: "goo", happening: "Win", eventId: `win:${e.tick}:${e.slimeId}`, playerId: owner }] : [];
    });
    const ops = [...changes.moves.map((m) => moveToChainOp(m, book)), ...changes.events.map(eventToChainOp), ...wins].filter((o): o is ChainOpPayload => o !== null);
    if (ops.length) await db.insert(chainOps).values(ops.map((payload) => ({ worldId: id, tick: world.tick, kind: payload.type, payload })));
  }
}

/**
 * Run `fn` on the locked town and save what it changed. With `wait: false`
 * it gives up (returns null) if someone else holds the lock.
 */
export async function withWorld<T>(
  db: Db,
  fn: (world: World, tx: Db) => Promise<{ result: T; changes: Changes }>,
  opts: { id?: string; wait?: boolean } = {},
): Promise<T | null> {
  const id = opts.id ?? MAIN_WORLD;
  return db.transaction(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    const key = sql`hashtext(${"world:" + id})`;
    if (opts.wait === false) {
      const lock = await tx.execute<{ ok: boolean }>(sql`select pg_try_advisory_xact_lock(${key}) as ok`);
      if (!lock.rows[0]?.ok) return null;
    } else {
      await tx.execute(sql`select pg_advisory_xact_lock(${key})`);
    }
    const world = await loadWorld(tx, id);
    const { result, changes } = await fn(world, tx);
    await persist(tx, id, world, changes);
    return result;
  });
}

/** Ids of slimes in a world whose chain mirror is ready. */
export async function readySlimes(db: Db, worldId: string, slimeIds: string[]): Promise<Set<string>> {
  if (!slimeIds.length) return new Set();
  const rows = await db
    .select({ id: slimeAccounts.slimeId })
    .from(slimeAccounts)
    .where(and(eq(slimeAccounts.worldId, worldId), inArray(slimeAccounts.slimeId, slimeIds), eq(slimeAccounts.status, "ready")));
  return new Set(rows.map((r) => r.id));
}
