/**
 * The slime's own simple brain for talking, used when NEAR AI isn't set up
 * or can't answer. It reads the slime's real state and answers the common
 * questions plainly, so a player always gets a useful, true reply.
 */
import { formatCoins } from "@/economy/money";
import { isLonely } from "@/economy/slimes";
import { moneyState } from "@/economy/state";
import type { Slime, World } from "@/economy/types";
import type { TalkAnswer } from "./answers";

type Feeling = TalkAnswer["feeling"];

/** What a slime should do next, in its own words. */
function nextStep(slime: Slime): string {
  if (slime.asleep) return "I'm too tired to move. Could you feed me? Tap Feed!";
  if (slime.energy < 35) return "I'm getting hungry. Tap Feed, or walk me to a food shop.";
  if (slime.job) return `I'm at my ${slime.job.kind} job right now. I'll be back with coins soon!`;
  if (slime.wallet < 2000n) return "Let's earn some coins! Walk me to the job board and pick a job.";
  return "Let's go to the race ground! If I win, I earn a prize.";
}

export function simpleReply(world: World, slime: Slime, said: string): TalkAnswer {
  const text = said.toLowerCase();
  const mood = isLonely(world, slime) ? "lonely" : moneyState(slime);
  const feeling: Feeling = slime.asleep ? "sleepy" : mood === "thriving" ? "happy" : mood === "hungry" ? "hungry" : mood === "broke" ? "worried" : mood === "lonely" ? "lonely" : "okay";
  const coins = formatCoins(slime.wallet);
  const say = (s: string): TalkAnswer => ({ say: s.slice(0, 100), feeling });

  if (/\b(hi|hello|hey|yo)\b/.test(text)) return say(`Hi! I'm ${slime.name}. ${nextStep(slime)}`);
  if (/how are you|how do you feel|you ok|feeling/.test(text)) {
    if (slime.asleep) return say("Zzz… I'm asleep. A snack would wake me up!");
    if (mood === "thriving") return say(`I feel great! I have ${coins} coins and lots of energy.`);
    if (mood === "hungry") return say("Hungry… my tummy is rumbling. Feed me, please?");
    if (mood === "broke") return say(`Worried. I only have ${coins} coins. I need a job!`);
    if (mood === "lonely") return say("A bit lonely. Play with me? Tap Pat!");
    return say(`I'm okay! I have ${coins} coins.`);
  }
  if (/where|what (should|do|now|next)|help|go\b|going/.test(text)) return say(nextStep(slime));
  if (/coin|money|rich|wallet|earn/.test(text)) return say(`I have ${coins} coins. I earn them at jobs and races, and spend on food.`);
  if (/hungry|food|eat|feed/.test(text)) return say(slime.energy < 50 ? "Yes please! Tap Feed and I'll eat the best deal in town." : "I'm full for now, thanks!");
  if (/job|work/.test(text)) return say(slime.job ? `I'm working a ${slime.job.kind} job.` : "The job board is near the shops. Walk me there and tap Find work!");
  if (/race|win|contest/.test(text)) return say(`I've won ${slime.wins} race${slime.wins === 1 ? "" : "s"}. Take me to the race ground to try again!`);
  if (/love|cute|good|friend/.test(text)) return { say: "Aww! You're my favourite keeper!", feeling: "happy" };
  return say(nextStep(slime));
}
