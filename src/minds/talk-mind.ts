/**
 * A slime answers its owner, on NEAR AI Cloud, from its real state. Asleep
 * slimes and slimes that can't pay for a thought answer without the model.
 */
import { THINK_COST } from "@/economy/config";
import { formatCoins } from "@/economy/money";
import { isLonely } from "@/economy/slimes";
import { moneyState } from "@/economy/state";
import type { Slime, World } from "@/economy/types";
import { extractJson, talkAnswerSchema, type TalkAnswer } from "./answers";
import { chatSigned, type MindProof } from "./client";
import { fill, loadPrompt, playerText } from "./prompts";
import { MIND_MAX_TOKENS, mindModel } from "./settings";

export type TalkReply = TalkAnswer & { thought: boolean; verified: boolean | null; proof: MindProof | Record<string, unknown> | null };

export function talkPrompt(world: World, slime: Slime): string {
  const doing = slime.job ? `you are at a ${slime.job.kind} job` : slime.asleep ? "you are asleep" : "you are at home";
  return fill(loadPrompt("talk"), {
    name: slime.name,
    personality: slime.personality,
    mood: isLonely(world, slime) ? "lonely" : moneyState(slime),
    balance: formatCoins(slime.wallet),
    energy: Math.round(slime.energy),
    joy: Math.round(slime.joy),
    doing,
    memory: slime.memory.slice(-5).map((m) => `- ${m}`).join("\n"),
  });
}

/** Lines for when the slime can't think. Short, true to its state. */
export function cannedReply(slime: Slime): TalkReply | null {
  if (slime.asleep) return { say: "Zzz… mmm… food…", feeling: "sleepy", thought: false, verified: null, proof: null };
  if (slime.wallet < THINK_COST) return { say: "I'm too broke to even think… a little coin?", feeling: "worried", thought: false, verified: null, proof: null };
  return null;
}

export async function talk(world: World, slime: Slime, said: string, opts: { model?: string; apiKey?: string; fetcher?: typeof fetch } = {}): Promise<TalkReply> {
  const canned = cannedReply(slime);
  if (canned) return canned;
  try {
    const model = opts.model ?? mindModel();
    const answer = await chatSigned({ model, system: talkPrompt(world, slime), user: playerText(said), maxTokens: MIND_MAX_TOKENS, apiKey: opts.apiKey, fetcher: opts.fetcher });
    const parsed = talkAnswerSchema.safeParse(extractJson(answer.content));
    if (!parsed.success) return { say: "Bloop? Say that again?", feeling: "okay", thought: true, verified: null, proof: { fallback: "Answer did not match the schema" } };
    return { say: parsed.data.say.slice(0, 100), feeling: parsed.data.feeling, thought: true, verified: answer.verified, proof: answer.proof };
  } catch {
    return { say: "My head is fuzzy… try again soon?", feeling: "okay", thought: false, verified: null, proof: { fallback: "Mind unavailable" } };
  }
}
