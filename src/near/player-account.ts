import { KeyPair } from "near-api-js";
import { PLAYER_ACCOUNT_FUNDING_YOCTO } from "@/economy/config";
import { gameAccount } from "./client";

/**
 * Account ids for players are short sub accounts of the game account:
 * "p-<id>.<game account>". Only a-z, 0-9 and "-" so they are valid NEAR ids.
 */
export function playerAccountId(playerId: string, game: string): string {
  const safe = playerId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (safe.length < 4) throw new Error("Player id too short for an account name");
  return `p-${safe}.${game}`;
}

export type NewAccount = { accountId: string; privateKey: string };

/**
 * Create the player's NEAR account on chain, funded by the game so the
 * player never sees gas or a seed phrase. Returns the new key; the caller
 * must store it encrypted.
 */
export async function createPlayerAccount(playerId: string): Promise<NewAccount> {
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  const accountId = playerAccountId(playerId, game.accountId);
  const keyPair = KeyPair.fromRandom("ed25519");
  await game.createAccount({
    newAccountId: accountId,
    publicKey: keyPair.getPublicKey(),
    nearToTransfer: PLAYER_ACCOUNT_FUNDING_YOCTO,
  });
  return { accountId, privateKey: keyPair.toString() };
}
