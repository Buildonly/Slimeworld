/**
 * Invite links: /?ref=<code>. The code is remembered in a cookie until the
 * friend signs in; when that friend hatches their first slime, both keepers
 * get INVITE_GIFT free coins. An inviter is rewarded for at most
 * INVITES_REWARDED_PER_WEEK friends a week.
 */
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import type { Db } from "@/db/client";
import { players, slimeAccounts } from "@/db/schema";
import { INVITE_GIFT, INVITES_REWARDED_PER_WEEK } from "@/economy/config";
import { inviteGift } from "@/economy/social";
import { newId } from "@/lib/ids";
import { allow } from "./rate-limit";
import { noChanges, withWorld } from "./world-store";

export const REF_COOKIE = "slime_ref";
const codeSchema = z.string().regex(/^[0-9a-z]{6,16}$/);
const WEEK_SECONDS = 7 * 24 * 60 * 60;

/** This player's invite code, made on first use. */
export async function inviteCode(db: Db, playerId: string): Promise<string> {
  const [p] = await db.select({ code: players.inviteCode }).from(players).where(eq(players.id, playerId));
  if (p?.code) return p.code;
  const code = newId(8);
  await db.update(players).set({ inviteCode: code }).where(and(eq(players.id, playerId), isNull(players.inviteCode)));
  const [again] = await db.select({ code: players.inviteCode }).from(players).where(eq(players.id, playerId));
  return again!.code!;
}

/** After sign in: if a new player came through someone's link, remember who invited them. */
export async function applyInviteCookie(db: Db, playerId: string): Promise<void> {
  const jar = await cookies();
  const parsed = codeSchema.safeParse(jar.get(REF_COOKIE)?.value);
  if (!parsed.success) return;
  jar.delete(REF_COOKIE);
  const [inviter] = await db.select({ id: players.id }).from(players).where(and(eq(players.inviteCode, parsed.data), ne(players.id, playerId)));
  if (!inviter) return;
  // Only brand-new keepers count as invited: no slime hatched yet.
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(slimeAccounts).where(eq(slimeAccounts.playerId, playerId));
  if (n > 0) return;
  await db.update(players).set({ invitedBy: inviter.id }).where(and(eq(players.id, playerId), isNull(players.invitedBy), eq(players.inviteRewarded, false)));
}

/** Call after a hatch: pays the invite gift once, if this player was invited. */
export async function rewardInvite(db: Db, playerId: string): Promise<boolean> {
  // Claim the reward atomically so it can only ever be paid once.
  const [claimed] = await db
    .update(players)
    .set({ inviteRewarded: true })
    .where(and(eq(players.id, playerId), eq(players.inviteRewarded, false)))
    .returning({ invitedBy: players.invitedBy });
  if (!claimed?.invitedBy) return false;
  const inviterCounts = await allow(db, `invite-reward:${claimed.invitedBy}`, INVITES_REWARDED_PER_WEEK, WEEK_SECONDS);
  await withWorld(db, async (world) => {
    const changes = noChanges();
    const r = inviteGift(world, inviterCounts ? claimed.invitedBy : null, playerId, INVITE_GIFT);
    changes.moves = world.journal.splice(0);
    if (r.ok) changes.events.push(r.event);
    return { result: null, changes };
  });
  return true;
}
