import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { newId } from "@/lib/ids";
import { encryptKey } from "@/near/keys";
import { createPlayerAccount } from "@/near/player-account";

export type PublicPlayer = { id: string; email: string | null; nearAccountId: string | null };

function toPublic(p: typeof players.$inferSelect): PublicPlayer {
  return { id: p.id, email: p.email, nearAccountId: p.nearAccountId };
}

/** Find the player for a sign-in identity, or make a new one. */
export async function findOrCreatePlayer(db: Db, authId: string, email: string | null): Promise<PublicPlayer> {
  const inserted = await db
    .insert(players)
    .values({ id: newId(), authId, email })
    .onConflictDoNothing({ target: players.authId })
    .returning();
  if (inserted[0]) return toPublic(inserted[0]);
  const [found] = await db.select().from(players).where(eq(players.authId, authId));
  if (!found) throw new Error("Player vanished");
  if (email && found.email !== email) {
    await db.update(players).set({ email }).where(eq(players.id, found.id));
    found.email = email;
  }
  return toPublic(found);
}

export async function getPlayer(db: Db, id: string): Promise<PublicPlayer | null> {
  const [row] = await db.select().from(players).where(eq(players.id, id));
  return row ? toPublic(row) : null;
}

/**
 * Make sure the player has a NEAR account. Safe to call many times: a
 * per-player advisory lock stops two requests creating it twice.
 */
export async function ensureNearAccount(db: Db, playerId: string): Promise<PublicPlayer> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"player:" + playerId}))`);
    const [row] = await tx.select().from(players).where(eq(players.id, playerId));
    if (!row) throw new Error("No such player");
    if (row.nearAccountId) return toPublic(row);
    const secret = serverEnv().KEYS_SECRET;
    if (!secret) throw new Error("KEYS_SECRET is not set");
    const account = await createPlayerAccount(row.id);
    const [updated] = await tx
      .update(players)
      .set({ nearAccountId: account.accountId, nearKeyEnc: encryptKey(account.privateKey, secret) })
      .where(eq(players.id, playerId))
      .returning();
    if (!updated) throw new Error("Player vanished");
    return toPublic(updated);
  });
}
