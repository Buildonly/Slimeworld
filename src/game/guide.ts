/**
 * What does your slime need most right now? Drives the one-line goal at the
 * top of the screen and the golden beam. Pure, so it can be tested.
 */
import type { SlimeDto, TownDto } from "@/lib/dto";
import type { Spot } from "./layout";

export type Goal = { text: string; spotId: string | null; button?: "feed" | "pat" };

const FOOD = ["berries", "jelly", "ice", "cake"];

export function guide(slime: SlimeDto, town: TownDto, spots: Spot[]): Goal | null {
  const name = slime.name;
  if (slime.state === "asleep") return { text: `${name} is asleep. Feed it to wake it up.`, spotId: null, button: "feed" };
  if (slime.energy < 40) {
    const food = town.shops
      .filter((s) => s.status !== "closed")
      .flatMap((s) => s.prices.filter((p) => FOOD.includes(p.item) && p.stock > 0).map((p) => ({ shop: s, price: BigInt(p.price) })))
      .sort((a, b) => (a.price < b.price ? -1 : 1))[0];
    if (food && spots.some((s) => s.id === food.shop.id)) return { text: `${name} is hungry. Hop to ${food.shop.name} for a snack.`, spotId: food.shop.id };
    return { text: `${name} is hungry. Tap Feed.`, spotId: null, button: "feed" };
  }
  if (slime.lonely) return { text: `${name} misses you. Give it a pat!`, spotId: null, button: "pat" };
  if (slime.job) return null;
  const wallet = BigInt(slime.wallet);
  if (wallet < BigInt(slime.rules.savingsTarget) * 2n && town.jobs.length) return { text: `${name} could use some coins. Visit the job board.`, spotId: "jobs" };
  const race = town.contests.find((c) => c.kind === "race" && !c.mine);
  if (race && slime.energy > 50 && slime.rules.allowedJobs.includes("race")) return { text: `A hop race starts in ${race.startsIn}h. Head to the race ground!`, spotId: "races" };
  return null;
}
