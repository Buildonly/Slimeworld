import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { ownedSlime, recordChat } from "@/economy/actions";
import { serverEnv } from "@/lib/env";
import { talk } from "@/minds/talk-mind";
import { fail, readJson } from "@/server/http";
import { processChainOps } from "@/server/chain-worker";
import { allow } from "@/server/rate-limit";
import { currentPlayerId } from "@/server/session";
import { loadWorld, noChanges, withWorld } from "@/server/world-store";
import { pitchFor } from "@/voice/settings";
import { voicePlan } from "@/voice/voices";
import { speak } from "@/voice/tts";

const schema = z.object({ slimeId: z.string().regex(/^s[0-9a-z]{1,10}$/), text: z.string().trim().min(1).max(200) });

/** Talk to your slime: it answers from its real mood, in its own voice. */
export async function POST(req: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return fail(401, "Please sign in.");
  if (!(await allow(db(), `talk:${playerId}`, 12, 60))) return fail(429, "Let it catch its breath!");
  const body = await readJson(req, schema);
  if (!body) return fail(400, "Say something first.");

  const world = await loadWorld(db());
  const slime = ownedSlime(world, playerId, body.slimeId);
  if (!slime) return fail(404, "Slime not found.");
  const env = serverEnv();
  const key = env.NEAR_AI_API_KEY === "proxy-injected" ? undefined : env.NEAR_AI_API_KEY;
  const reply = await talk(world, slime, body.text, { model: env.NEAR_AI_MODEL, apiKey: key });

  // Pay for the thought and log it, on the locked town.
  await withWorld(db(), async (w) => {
    const changes = noChanges();
    const d = recordChat(w, playerId, body.slimeId, reply);
    const signed = Boolean(reply.proof && "signature" in reply.proof && reply.proof.signature);
    const source = !reply.thought ? "rule" : signed ? "near-ai" : "heuristic";
    if (d) changes.decisions.push({ ...d, source, verified: reply.verified, signature: null, proof: reply.proof as Record<string, unknown> | null });
    changes.moves = w.journal.splice(0);
    return { result: null, changes };
  });
  after(() => processChainOps(db()).catch(() => undefined));

  const voice = (await voicePlan().catch(() => null))?.voices[slime.personality] ?? null;
  const hash = voice ? await speak(db(), voice.id, reply.say).catch(() => null) : null;
  return Response.json({
    ok: true,
    say: reply.say,
    feeling: reply.feeling,
    verified: reply.verified,
    audio: hash ? `/api/voice/${hash}` : null,
    pitch: pitchFor(slime.size),
    voice: voice?.name ?? null,
  });
}
