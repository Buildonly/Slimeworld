/** How slimes sound. Voices are ElevenLabs premade voices, chosen by personality. */
import type { SlimePersonality } from "@/economy/config";

export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
/** Fast and half the price of the multilingual models; fine for short lines. */
export const TTS_MODEL = "eleven_flash_v2_5";
export const TTS_FORMAT = "mp3_44100_64";
/** Longest line a slime will say out loud. */
export const MAX_SPOKEN_CHARS = 120;

export const VOICES: Record<SlimePersonality, { id: string; name: string }> = {
  social: { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  thrifty: { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  brave: { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  lazy: { id: "bIHbv24MWmeRgasZH58o", name: "Will" },
  greedy: { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum" },
};

/**
 * Young slimes squeak: play the line faster (higher) when small, settling as
 * the slime grows (size 0.8 to 1.4).
 */
export function pitchFor(size: number): number {
  const t = Math.min(1, Math.max(0, (size - 0.8) / 0.6));
  return Number((1.32 - t * 0.22).toFixed(2));
}
