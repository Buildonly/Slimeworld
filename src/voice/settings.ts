/** How slimes sound. Voices and the speech model come live from ElevenLabs (see voices.ts). */
import { serverEnv } from "@/lib/env";

export const TTS_FORMAT = "mp3_44100_64";
/** Longest line a slime will say out loud. */
export const MAX_SPOKEN_CHARS = 120;

/** ElevenLabs API base URL, from ELEVENLABS_URL. */
export function elevenLabsUrl(): string | null {
  return serverEnv().ELEVENLABS_URL?.replace(/\/$/, "") ?? null;
}

/**
 * Young slimes squeak: play the line faster (higher) when small, settling as
 * the slime grows (size 0.8 to 1.4).
 */
export function pitchFor(size: number): number {
  const t = Math.min(1, Math.max(0, (size - 0.8) / 0.6));
  return Number((1.32 - t * 0.22).toFixed(2));
}
