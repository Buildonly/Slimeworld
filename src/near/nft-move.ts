/**
 * Move a slime's NFT (NEP-171) from the player's game-held account into
 * their own NEAR wallet. Signed by the player's account and relayed, so no
 * popup and no gas. nft_transfer needs exactly 1 yoctoNEAR attached; the
 * game tops the account up by only what it is missing for that.
 */
import { Account, actions, teraToGas, type KeyPairString } from "near-api-js";
import { gameAccount, livePrices, nearProvider } from "./client";
import { topUpTo } from "./costs";
import { ids, relay, relayFailure } from "./town-chain";

const ONE_YOCTO = 1n;
const GAS = teraToGas("30");

export async function nftOwner(tokenId: string): Promise<string | null> {
  const t = await nearProvider().callFunction<{ owner_id: string }>({ contractId: ids().nft, method: "nft_token", args: { token_id: tokenId } });
  return t?.owner_id ?? null; // null when the token doesn't exist
}

export async function moveSlimeNft(args: { accountId: string; fullKey: string; tokenId: string; to: string }): Promise<string> {
  const game = gameAccount();
  if (!game) throw new Error("NEAR game account is not configured");
  await topUpTo(game, await livePrices(), args.accountId, ONE_YOCTO);
  const player = new Account(args.accountId, nearProvider(), args.fullKey as KeyPairString);
  const { signedDelegate } = await player.createSignedMetaTransaction({
    receiverId: ids().nft,
    actions: [actions.functionCall("nft_transfer", { receiver_id: args.to, token_id: args.tokenId, memo: "Moved to my own wallet" }, GAS, ONE_YOCTO)],
  });
  const res = await relay(signedDelegate);
  const failure = relayFailure(res);
  if (failure) throw new Error(`The move was refused: ${JSON.stringify(failure).slice(0, 160)}`);
  return res.transaction.hash;
}
