import { db } from "@/db/client";
import { cachedLine } from "@/voice/tts";

/** A cached spoken line. Lines never change, so browsers may keep them. */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^[0-9a-f]{40}$/.test(hash)) return new Response("Not found", { status: 404 });
  const audio = await cachedLine(db(), hash);
  if (!audio) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(audio), { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000, immutable" } });
}
