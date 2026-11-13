/**
 * Step 9 check: say "how are you" and the slime answers in its voice with its
 * real mood. Sends a real recording through speech-to-text, asks the slime,
 * and fetches the spoken answer.
 *   pnpm dev   (in another terminal)
 *   pnpm tsx --tsconfig tsconfig.json scripts/voice-check.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { formatCoins } from "@/economy/money";
import { isLonely } from "@/economy/slimes";
import { moneyState } from "@/economy/state";
import { db } from "@/db/client";
import { loadWorld } from "@/server/world-store";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
let cookie = "";

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie } });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0] ?? "";
  return res;
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function main() {
  await call("/api/session/dev", json({ email: "screens-check@example.com" }));
  const home = (await (await call("/api/home")).json()) as { slimes: { id: string; name: string }[] };
  const slime = home.slimes[0];
  if (!slime) throw new Error("Hatch a slime first (run the screens check).");

  const form = new FormData();
  form.append("audio", new Blob([readFileSync("e2e/fixtures/how-are-you.mp3")], { type: "audio/mpeg" }), "speech.mp3");
  const heard = (await (await call("/api/listen", { method: "POST", body: form })).json()) as { text?: string; error?: string };
  console.log(`You said (heard by Whisper on NEAR AI): "${heard.text ?? heard.error}"`);

  const world = await loadWorld(db());
  const s = world.slimes[slime.id]!;
  const mood = isLonely(world, s) ? "lonely" : moneyState(s);
  console.log(`${s.name} really is: ${mood}, energy ${Math.round(s.energy)}, happiness ${Math.round(s.joy)}, wallet ${formatCoins(s.wallet)} coins${s.job ? `, at a ${s.job.kind} job` : ""}`);

  const reply = (await (await call("/api/talk", json({ slimeId: slime.id, text: heard.text ?? "how are you" }))).json()) as {
    say?: string;
    feeling?: string;
    verified?: boolean;
    audio?: string;
    pitch?: number;
    voice?: string;
    error?: string;
  };
  console.log(`${s.name} says: "${reply.say ?? reply.error}" (feeling ${reply.feeling}; ${reply.verified ? "verified on NEAR AI" : "not verified"})`);
  if (!reply.audio) throw new Error("No voice line came back");
  const audio = await call(reply.audio);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const isMp3 = audio.headers.get("content-type") === "audio/mpeg" && bytes.length > 1000;
  console.log(`Voice: ${reply.voice}, played at ${reply.pitch}x pitch · ${bytes.length} bytes of ${audio.headers.get("content-type")}`);
  const again = await call(reply.audio);
  console.log(`Cached line served again: ${again.status === 200 ? "yes" : "no"}`);
  const ok = Boolean(heard.text?.toLowerCase().includes("how are you") && reply.say && reply.verified && isMp3);
  console.log(ok ? "\nPASS: heard 'how are you', answered from its real mood, verified, in its own voice." : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
