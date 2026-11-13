/**
 * The owner's spending rules, checked before every slime spend. The town
 * contract checks the same rules again on chain.
 */
import { STARVING_BELOW, type Bits, type ItemCategory, type JobKind } from "./config";
import type { Slime } from "./types";

export type SpendCheck = { ok: true } | { ok: false; why: string };

/**
 * May this slime spend `amount` on `category` now? Food may dip below the
 * savings target when the slime is starving (prompts/slime.md).
 */
export function canSpend(slime: Slime, category: ItemCategory | "Race", amount: Bits): SpendCheck {
  if (amount <= 0n) return { ok: false, why: "Nothing to pay" };
  if (amount > slime.wallet) return { ok: false, why: "Not enough coins" };
  if (category !== "Race" && !slime.rules.allowed.includes(category)) return { ok: false, why: "My owner said no" };
  if (category === "Race" && !slime.rules.allowedJobs.includes("race") && !slime.rules.allowedJobs.includes("puzzle"))
    return { ok: false, why: "My owner said no contests" };
  if (slime.spentToday + amount > slime.rules.dailyLimit) return { ok: false, why: "Over my daily limit" };
  const emergency = category === "Food" && slime.energy < STARVING_BELOW;
  if (!emergency && slime.wallet - amount < slime.rules.savingsTarget) return { ok: false, why: "I'm saving" };
  return { ok: true };
}

export function mayTakeJob(slime: Slime, kind: JobKind): boolean {
  return slime.rules.allowedJobs.includes(kind);
}

/** Take the coins and count them against today's limit. */
export function recordSpend(slime: Slime, amount: Bits): void {
  slime.wallet -= amount;
  slime.spentToday += amount;
}
