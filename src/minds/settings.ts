/**
 * How the game talks to NEAR AI Cloud. (What a thought costs a slime is an
 * economy number: THINK_COST in src/economy/config.ts.)
 */
import { serverEnv } from "@/lib/env";

/** NEAR AI Cloud base URL, from NEAR_AI_URL. */
export function nearAiUrl(): string {
  const url = serverEnv().NEAR_AI_URL;
  if (!url) throw new Error("NEAR_AI_URL is not set");
  return url.replace(/\/$/, "");
}

/** The model slimes and shopkeepers think with, from NEAR_AI_MODEL. */
export function mindModel(): string {
  const model = serverEnv().NEAR_AI_MODEL;
  if (!model) throw new Error("NEAR_AI_MODEL is not set");
  return model;
}
export const MIND_MAX_TOKENS = 160;
export const MIND_TIMEOUT_MS = 8_000;
/** Re-check the model's attestation this often. */
export const ATTESTATION_TTL_MS = 60 * 60 * 1000;
/** Most NEAR AI calls in one tick; other slimes use the free heuristic mind that tick. */
export const MIND_CALLS_PER_TICK = 6;
