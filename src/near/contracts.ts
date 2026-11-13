/**
 * The game's contracts are sub accounts of the game account:
 * nft.<game> (NEP-171 slimes), items.<game> (NEP-245 items), town.<game>.
 */
export type ContractIds = { nft: string; items: string; town: string };

export function contractIds(gameAccount: string): ContractIds {
  return { nft: `nft.${gameAccount}`, items: `items.${gameAccount}`, town: `town.${gameAccount}` };
}
