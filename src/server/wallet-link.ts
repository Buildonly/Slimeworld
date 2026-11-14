/**
 * Link a player's own NEAR wallet. The game hands out a one-time message;
 * the wallet signs it (NEP-413); we check the signature against a full
 * access key of that account on chain, then remember the wallet. Each
 * message works once and only for a few minutes.
 */
import { randomBytes } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { verifyMessage } from "near-api-js/nep413";
import type { Db } from "@/db/client";
import { players, walletChallenges } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { nearProvider } from "@/near/client";

export const LINK_MESSAGE = "Link my NEAR wallet to my slimes";
const CHALLENGE_MS = 10 * 60 * 1000;

/** Who the message is addressed to: the game's own account, so it can't be replayed elsewhere. */
export function linkRecipient(): string {
  const game = serverEnv().NEAR_GAME_ACCOUNT;
  if (!game) throw new Error("NEAR_GAME_ACCOUNT is not set");
  return game;
}

export async function newChallenge(db: Db, playerId: string): Promise<{ message: string; recipient: string; nonce: string }> {
  const nonce = randomBytes(32).toString("base64");
  await db.insert(walletChallenges).values({ nonce, playerId });
  return { message: LINK_MESSAGE, recipient: linkRecipient(), nonce };
}

export type LinkResult = { ok: true; accountId: string } | { ok: false; message: string };

export async function linkWallet(db: Db, playerId: string, signed: { accountId: string; publicKey: string; signature: string; nonce: string }): Promise<LinkResult> {
  // Use the challenge exactly once, and only if it is fresh and this player's.
  const [challenge] = await db
    .delete(walletChallenges)
    .where(and(eq(walletChallenges.nonce, signed.nonce), eq(walletChallenges.playerId, playerId), gt(walletChallenges.createdAt, new Date(Date.now() - CHALLENGE_MS))))
    .returning();
  if (!challenge) return { ok: false, message: "That request expired. Try connecting again." };
  try {
    await verifyMessage({
      signerAccountId: signed.accountId,
      signerPublicKey: signed.publicKey,
      payload: { message: LINK_MESSAGE, recipient: linkRecipient(), nonce: new Uint8Array(Buffer.from(signed.nonce, "base64")) },
      signature: new Uint8Array(Buffer.from(signed.signature, "base64")),
      provider: nearProvider(),
    });
  } catch {
    return { ok: false, message: "We couldn't confirm that wallet. Try again." };
  }
  const [taken] = await db.select({ id: players.id }).from(players).where(and(eq(players.walletAccountId, signed.accountId), ne(players.id, playerId)));
  if (taken) return { ok: false, message: "That wallet is already linked to another player." };
  await db.update(players).set({ walletAccountId: signed.accountId }).where(eq(players.id, playerId));
  return { ok: true, accountId: signed.accountId };
}
