/**
 * The slime's mind on NEAR AI Cloud. Builds the prompt from prompts/slime.md,
 * asks the model, checks the answer with Zod and against the allowed options,
 * and returns the choice with its signature proof. Falls back to the
 * heuristic mind on any failure, and says so in the decision.
 */
import { ITEMS, THINK_COST } from "@/economy/config";
import { cheapestSellers } from "@/economy/market";
import { heuristicMind, type Mind, type MindChoice, type MindContext } from "@/economy/mind";
import { formatCoins } from "@/economy/money";
import { moneyState } from "@/economy/state";
import { isLonely } from "@/economy/slimes";
import { extractJson, slimeAnswerSchema } from "./answers";
import { chatSigned } from "./client";
import { fill, loadPrompt, playerText } from "./prompts";
import { MIND_MAX_TOKENS } from "./settings";

export function slimePrompt(ctx: MindContext): { system: string; user: string } {
  const { slime, options, world } = ctx;
  const mood = world && isLonely(world, slime) ? "lonely" : moneyState(slime);
  const prices = world
    ? ITEMS.map((i) => {
        const o = cheapestSellers(world, i.id)[0];
        return o ? `- ${i.title}: ${formatCoins(o.price)} at ${o.shop.name}` : `- ${i.title}: sold out`;
      }).join("\n")
    : "- unknown";
  const jobs = options.filter((o) => o.action === "job" || o.action === "race" || o.action === "puzzle").map((o) => `- ${o.label}`).join("\n") || "- none";
  const actions = options.map((o) => `- ${JSON.stringify({ action: o.action, target: o.target })}: ${o.label}${o.cost > 0n ? ` (costs ${formatCoins(o.cost)})` : ""}`).join("\n");
  const system = fill(loadPrompt("slime"), {
    name: slime.name,
    personality: slime.personality,
    ageDays: Math.floor((ctx.tick - slime.bornTick) / 24),
    mood,
    balance: `${formatCoins(slime.wallet)} (${slime.wallet >= slime.rules.savingsTarget * 2n ? "well above" : slime.wallet >= slime.rules.savingsTarget ? "above" : "below"} your savings target)`,
    savingsTarget: formatCoins(slime.rules.savingsTarget),
    thinkCost: formatCoins(THINK_COST),
    energy: Math.round(slime.energy),
    speed: slime.skills.speed,
    smarts: slime.skills.smarts,
    charm: slime.skills.charm,
    dailyLimitLeft: formatCoins(slime.rules.dailyLimit - slime.spentToday),
    allowedCategories: slime.rules.allowed.join(", ").toLowerCase(),
    allowedJobs: slime.rules.allowedJobs.join(", "),
    memory: slime.memory.slice(-6).map((m) => `- ${m}`).join("\n"),
    prices,
    jobs,
    allowedActions: actions,
  });
  const user = ctx.playerSaid
    ? `Your owner says: ${playerText(ctx.playerSaid)}\nDecide now.`
    : "Decide what to do now.";
  return { system, user };
}

export function nearAiSlimeMind(model: string, apiKey?: string, fetcher?: typeof fetch): Mind {
  return {
    name: "near-ai",
    async decide(ctx: MindContext): Promise<MindChoice> {
      const fallback = async (why: string): Promise<MindChoice> => {
        const h = await heuristicMind.decide(ctx);
        return { ...h, source: "heuristic", proof: { fallback: why } };
      };
      try {
        const { system, user } = slimePrompt(ctx);
        const answer = await chatSigned({ model, system, user, maxTokens: MIND_MAX_TOKENS, apiKey, fetcher });
        const parsed = slimeAnswerSchema.safeParse(extractJson(answer.content));
        if (!parsed.success) return fallback("Answer did not match the schema");
        const a = parsed.data;
        const allowed = ctx.options.some((o) => o.action === a.action && o.target === a.target);
        if (!allowed) return fallback("Answer was not one of the allowed actions");
        return {
          action: a.action,
          target: a.target,
          reason: a.reason.slice(0, 90),
          say: a.say ? a.say.slice(0, 60) : null,
          verified: answer.verified,
          signature: answer.proof.signature || null,
          proof: answer.proof,
          source: "near-ai",
        };
      } catch (err) {
        return fallback(err instanceof Error ? err.message.slice(0, 80) : "Mind unavailable");
      }
    },
  };
}

/**
 * Spend at most `perTick` NEAR AI calls per tick. Slimes owned by real players
 * go first; everyone else uses the free heuristic when the budget is spent.
 */
export function budgetedMind(ai: Mind, perTick: number, priority: (ctx: MindContext) => boolean): Mind {
  let tick = -1;
  let used = 0;
  return {
    name: "near-ai",
    async decide(ctx) {
      if (ctx.tick !== tick) {
        tick = ctx.tick;
        used = 0;
      }
      if (used < perTick || priority(ctx)) {
        used += 1;
        return ai.decide(ctx);
      }
      return { ...(await heuristicMind.decide(ctx)), source: "heuristic" };
    },
  };
}
