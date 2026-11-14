/**
 * "Your first day": five small steps that show a new keeper what the game
 * is, one at a time, each with the golden beam pointing the way. Pure.
 */
import type { Goal } from "./guide";

export type StepId = "talk" | "feed" | "job" | "square" | "race";
type Step = { id: StepId; text: (name: string) => string; spotId: string | null; button?: Goal["button"] };

export const FIRST_DAY: readonly Step[] = [
  { id: "talk", text: (n) => `Say hi to ${n}: tap Talk and say hello.`, spotId: null, button: "talk" },
  { id: "feed", text: (n) => `Feed ${n}: tap Feed. It picks the best deal in town.`, spotId: null, button: "feed" },
  { id: "job", text: (n) => `Follow the gold beam to the job board and send ${n} to work.`, spotId: "jobs" },
  { id: "square", text: () => "Hop to the fountain: see who's winning and meet other keepers.", spotId: "fountain" },
  { id: "race", text: (n) => `Take ${n} to the race ground and enter a race to win coins.`, spotId: "races" },
];

export function firstDayStep(done: ReadonlySet<StepId>): { step: Step; index: number } | null {
  const index = FIRST_DAY.findIndex((s) => !done.has(s.id));
  return index < 0 ? null : { step: FIRST_DAY[index]!, index };
}
