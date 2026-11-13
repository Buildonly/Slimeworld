/**
 * Text to speech with ElevenLabs, cached in Postgres by sha256(voice + text).
 * The key comes from ELEVENLABS_API_KEY (or is injected by the network proxy in
 * local development); it is never logged or sent to the browser.
 */
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { voiceLines } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { ELEVENLABS_BASE_URL, MAX_SPOKEN_CHARS, TTS_FORMAT, TTS_MODEL } from "./settings";

export function lineHash(voiceId: string, text: string): string {
  return createHash("sha256").update(`${voiceId}\n${text}`).digest("hex").slice(0, 40);
}

/** Make sure the line exists in the cache; returns its hash, or null if speech is unavailable. */
export async function speak(db: Db, voiceId: string, raw: string): Promise<string | null> {
  const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_SPOKEN_CHARS);
  if (!text) return null;
  const hash = lineHash(voiceId, text);
  const [hit] = await db.select({ hash: voiceLines.hash }).from(voiceLines).where(eq(voiceLines.hash, hash));
  if (hit) return hash;
  const key = serverEnv().ELEVENLABS_API_KEY;
  if (!key) return null;
  const res = await fetch(`${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${TTS_FORMAT}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "audio/mpeg", ...(key === "proxy-injected" ? {} : { "xi-api-key": key }) },
    body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, speed: 1.05 } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const audio = Buffer.from(await res.arrayBuffer());
  await db.insert(voiceLines).values({ hash, voiceId, text, audio }).onConflictDoNothing();
  return hash;
}

export async function cachedLine(db: Db, hash: string): Promise<Buffer | null> {
  const [row] = await db.select({ audio: voiceLines.audio }).from(voiceLines).where(eq(voiceLines.hash, hash));
  return row?.audio ?? null;
}
