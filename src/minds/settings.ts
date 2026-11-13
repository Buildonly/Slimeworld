/**
 * How the game talks to NEAR AI Cloud. (What a thought costs a slime is an
 * economy number: THINK_COST in src/economy/config.ts.)
 */
export const NEAR_AI_BASE_URL = "https://cloud-api.near.ai/v1";
/** Runs in NEAR AI's TEEs (signature kind "provider_tee"), fast, cheap, structured output. */
export const DEFAULT_MIND_MODEL = "Qwen/Qwen3.6-35B-A3B-FP8";
export const MIND_MAX_TOKENS = 160;
export const MIND_TIMEOUT_MS = 8_000;
/** Re-check the model's attestation this often. */
export const ATTESTATION_TTL_MS = 60 * 60 * 1000;
/** Most NEAR AI calls in one tick; other slimes use the free heuristic mind that tick. */
export const MIND_CALLS_PER_TICK = 6;
