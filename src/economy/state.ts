/** Which of the five looks a slime has right now (docs/PRODUCT.md). */
import { BROKE_BELOW, HUNGRY_BELOW, THRIVING_ABOVE } from "./config";
import type { Slime } from "./types";

export type MoneyState = "thriving" | "fine" | "hungry" | "broke" | "asleep";

export function moneyState(slime: Slime): MoneyState {
  if (slime.asleep) return "asleep";
  if (slime.wallet < BROKE_BELOW) return "broke";
  if (slime.energy < HUNGRY_BELOW) return "hungry";
  if (slime.wallet >= THRIVING_ABOVE && slime.energy >= 60 && slime.earnedYesterday + slime.earnedToday > 0n) return "thriving";
  return "fine";
}
