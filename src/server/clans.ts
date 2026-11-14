/** Clans: keepers who play together. Membership lives in the database; scores come from the town. */
import { and, count, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { clans, players } from "@/db/schema";
import { CLAN_MAX_MEMBERS, type Bits } from "@/economy/config";
import type { World } from "@/economy/types";
import { newId } from "@/lib/ids";

export type ClanResult = { ok: true; message: string } | { ok: false; message: string };
export type ClanView = { id: string; name: string; code: string; members: { id: string; name: string; coins: string; wins: number; slimes: string[] }[] } | null;
export type ClanRank = { rank: number; id: string; name: string; members: number; coins: string; wins: number; mine: boolean };

export async function createClan(db: Db, playerId: string, name: string): Promise<ClanResult> {
  const [me] = await db.select({ clanId: players.clanId }).from(players).where(eq(players.id, playerId));
  if (me?.clanId) return { ok: false, message: "Leave your clan first." };
  const [taken] = await db.select({ id: clans.id }).from(clans).where(eq(clans.name, name));
  if (taken) return { ok: false, message: "That name is taken. Try another!" };
  const id = newId();
  await db.insert(clans).values({ id, name, code: newId(6), createdBy: playerId });
  await db.update(players).set({ clanId: id }).where(eq(players.id, playerId));
  return { ok: true, message: `${name} is founded!` };
}

export async function joinClan(db: Db, playerId: string, code: string): Promise<ClanResult> {
  const [clan] = await db.select().from(clans).where(eq(clans.code, code));
  if (!clan) return { ok: false, message: "No clan has that code." };
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(players).where(eq(players.clanId, clan.id));
  if (n >= CLAN_MAX_MEMBERS) return { ok: false, message: "That clan is full." };
  const joined = await db.update(players).set({ clanId: clan.id }).where(and(eq(players.id, playerId), isNull(players.clanId))).returning({ id: players.id });
  if (!joined.length) return { ok: false, message: "Leave your clan first." };
  return { ok: true, message: `Welcome to ${clan.name}!` };
}

export async function leaveClan(db: Db, playerId: string): Promise<ClanResult> {
  await db.update(players).set({ clanId: null }).where(eq(players.id, playerId));
  return { ok: true, message: "You left the clan." };
}

/** Everything a player holds in town: purse plus their slimes, and their slimes' wins. */
function worth(world: World, playerId: string): { coins: Bits; wins: number; slimes: string[] } {
  const mine = Object.values(world.slimes).filter((s) => s.ownerId === playerId);
  return {
    coins: (world.players[playerId]?.wallet ?? 0n) + mine.reduce((t, s) => t + s.wallet, 0n),
    wins: mine.reduce((t, s) => t + s.wins, 0),
    slimes: mine.map((s) => s.name),
  };
}

export async function myClan(db: Db, world: World, playerId: string): Promise<ClanView> {
  const [me] = await db.select({ clanId: players.clanId }).from(players).where(eq(players.id, playerId));
  if (!me?.clanId) return null;
  const [clan] = await db.select().from(clans).where(eq(clans.id, me.clanId));
  if (!clan) return null;
  const members = await db.select({ id: players.id }).from(players).where(eq(players.clanId, clan.id));
  return {
    id: clan.id,
    name: clan.name,
    code: clan.code,
    members: members.map((m) => {
      const w = worth(world, m.id);
      return { id: m.id, name: world.players[m.id]?.name ?? "A new keeper", coins: w.coins.toString(), wins: w.wins, slimes: w.slimes };
    }),
  };
}

/** Clans ranked by everything their members hold. */
export async function clanBoard(db: Db, world: World, viewerId: string | null, size: number): Promise<ClanRank[]> {
  const rows = await db.select({ clanId: players.clanId, playerId: players.id }).from(players);
  const all = await db.select().from(clans);
  const byClan = new Map<string, string[]>();
  for (const r of rows) if (r.clanId) byClan.set(r.clanId, [...(byClan.get(r.clanId) ?? []), r.playerId]);
  const [me] = viewerId ? rows.filter((r) => r.playerId === viewerId) : [];
  return all
    .map((c) => {
      const ids = byClan.get(c.id) ?? [];
      const totals = ids.map((id) => worth(world, id));
      return { id: c.id, name: c.name, members: ids.length, coins: totals.reduce((t, x) => t + x.coins, 0n), wins: totals.reduce((t, x) => t + x.wins, 0), mine: me?.clanId === c.id };
    })
    .filter((c) => c.members > 0)
    .sort((a, b) => (b.coins > a.coins ? 1 : b.coins < a.coins ? -1 : b.wins - a.wins))
    .slice(0, size)
    .map((c, i) => ({ ...c, rank: i + 1, coins: c.coins.toString() }));
}
