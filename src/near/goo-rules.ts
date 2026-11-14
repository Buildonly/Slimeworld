/** $GOO amounts as the contract takes them: whole GOO from the economy config, in its smallest units. */
import { GOO, GOO_DECIMALS } from "../economy/config";

export const goo = (whole: bigint): string => (whole * 10n ** BigInt(GOO_DECIMALS)).toString();

export function gooRules() {
  return {
    care_reward: goo(GOO.careReward),
    win_reward: goo(GOO.winReward),
    rescue_burn: goo(GOO.rescueBurn),
    item_prices: Object.fromEntries(Object.entries(GOO.prices).map(([id, n]) => [id, goo(n)])),
  };
}

/** Smallest units back to whole GOO, rounded down, for display. */
export const wholeGoo = (units: bigint): bigint => units / 10n ** BigInt(GOO_DECIMALS);
