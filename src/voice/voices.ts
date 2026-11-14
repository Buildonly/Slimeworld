/**
 * Slime voices, picked live from ElevenLabs' own voice library: each
 * personality gets the voice whose labels fit it best, all different.
 * The speech model is ELEVENLABS_MODEL, or else the cheapest text to speech
 * model ElevenLabs lists. Cached for an hour.
 */
import { z } from "zod";
import type { SlimePersonality } from "@/economy/config";
import { serverEnv } from "@/lib/env";
import { elevenLabsUrl } from "./settings";

export type Voice = { id: string; name: string };
export type VoicePlan = { model: string; voices: Record<SlimePersonality, Voice> };

const voiceSchema = z.object({ voice_id: z.string().min(1), name: z.string(), labels: z.record(z.string(), z.string()).optional() });
const modelSchema = z.object({
  model_id: z.string().min(1),
  can_do_text_to_speech: z.boolean().optional(),
  model_rates: z.object({ character_cost_multiplier: z.number() }).optional(),
});

/** Words that suit each personality, matched against a voice's name and labels. */
const FIT: Record<SlimePersonality, string[]> = {
  social: ["sassy", "upbeat", "social", "enthusiast", "bright", "quirky"],
  thrifty: ["calm", "professional", "informative", "neutral", "relaxed"],
  brave: ["fierce", "warrior", "confident", "hyped", "energetic", "deep"],
  lazy: ["laid-back", "casual", "relaxed", "chill", "calm"],
  greedy: ["trickster", "husky", "rough", "classy"],
};
const ORDER: SlimePersonality[] = ["greedy", "brave", "social", "lazy", "thrifty"];

function headers(): Record<string, string> {
  const key = serverEnv().ELEVENLABS_API_KEY;
  return key && key !== "proxy-injected" ? { "xi-api-key": key } : {};
}

/** Give each personality its best fitting voice; no two share one. Pure, for tests. */
export function assignVoices(raw: unknown[]): Record<SlimePersonality, Voice> | null {
  const voices = raw.flatMap((v) => {
    const r = voiceSchema.safeParse(v);
    return r.success ? [r.data] : [];
  });
  if (voices.length < ORDER.length) return null;
  const taken = new Set<string>();
  const out = {} as Record<SlimePersonality, Voice>;
  for (const personality of ORDER) {
    const score = (v: (typeof voices)[number]) => {
      const text = `${v.name} ${Object.values(v.labels ?? {}).join(" ")}`.toLowerCase();
      return FIT[personality].filter((w) => text.includes(w)).length + (v.labels?.age === "young" ? 0.5 : 0);
    };
    const best = voices.filter((v) => !taken.has(v.voice_id)).sort((a, b) => score(b) - score(a))[0]!;
    taken.add(best.voice_id);
    out[personality] = { id: best.voice_id, name: best.name.split(" - ")[0]!.trim() };
  }
  return out;
}

/** The cheapest text to speech model in ElevenLabs' list. Pure, for tests. */
export function cheapestModel(raw: unknown[]): string | null {
  const models = raw.flatMap((m) => {
    const r = modelSchema.safeParse(m);
    return r.success && r.data.can_do_text_to_speech ? [r.data] : [];
  });
  models.sort((a, b) => (a.model_rates?.character_cost_multiplier ?? 1) - (b.model_rates?.character_cost_multiplier ?? 1));
  return models[0]?.model_id ?? null;
}

let cache: { at: number; plan: VoicePlan } | undefined;

export async function voicePlan(): Promise<VoicePlan | null> {
  if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.plan;
  const base = elevenLabsUrl();
  if (!base || !serverEnv().ELEVENLABS_API_KEY) return null;
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`, { headers: headers(), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`ElevenLabs: HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  };
  const [voicesBody, modelsBody] = await Promise.all([get("/v2/voices?voice_type=default&page_size=100"), serverEnv().ELEVENLABS_MODEL ? null : get("/v1/models")]);
  const voices = assignVoices(z.object({ voices: z.array(z.unknown()) }).parse(voicesBody).voices);
  const model = serverEnv().ELEVENLABS_MODEL ?? cheapestModel(z.array(z.unknown()).parse(modelsBody));
  if (!voices || !model) return null;
  cache = { at: Date.now(), plan: { model, voices } };
  return cache.plan;
}
