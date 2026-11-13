import { z } from "zod";
import { db } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { NEAR_AI_BASE_URL } from "@/minds/settings";
import { fail } from "@/server/http";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";

const MAX_BYTES = 1_000_000;
const WHISPER_MODEL = "openai/whisper-large-v3";
const answerSchema = z.object({ text: z.string().max(1000) });

/**
 * Speech to text for browsers without built-in speech recognition: the
 * recording goes to Whisper (open source) on NEAR AI Cloud. Audio is not kept.
 */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `listen:${playerId}`, 12, 60))) return fail(429, "Slow down a little!");
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return fail(400, "No sound came through.");
  if (audio.size > MAX_BYTES) return fail(413, "That's a long speech! Keep it short.");
  const key = serverEnv().NEAR_AI_API_KEY;
  if (!key) return fail(503, "Listening is not set up yet.");
  const out = new FormData();
  out.append("model", WHISPER_MODEL);
  out.append("file", audio, "speech.webm");
  const res = await fetch(`${NEAR_AI_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: key === "proxy-injected" ? {} : { authorization: `Bearer ${key}` },
    body: out,
    signal: AbortSignal.timeout(20_000),
  });
  const parsed = answerSchema.safeParse(await res.json().catch(() => null));
  if (!res.ok || !parsed.success) return fail(502, "I couldn't hear that. Try again?");
  return Response.json({ ok: true, text: parsed.data.text.trim() });
}
