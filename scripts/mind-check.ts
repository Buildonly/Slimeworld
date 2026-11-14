/**
 * Step 6 check: one slime makes 10 decisions in a row on NEAR AI Cloud, each
 * stored with its reason, cost and verified flag.
 *   pnpm tsx --tsconfig tsconfig.json scripts/mind-check.ts
 */
import "dotenv/config";
import { db } from "@/db/client";
import { decisions } from "@/db/schema";
import { coins } from "@/economy/config";
import { heuristicMind, type Mind } from "@/economy/mind";
import { formatCoins } from "@/economy/money";
import { defaultMinds, runTick } from "@/economy/tick";
import type { Decision } from "@/economy/types";
import { createTown } from "@/economy/world";
import { mindModel } from "@/minds/settings";
import { nearAiSlimeMind } from "@/minds/slime-mind";

async function main() {
  const world = createTown(42, 30);
  const star = Object.values(world.slimes)[0]!;
  star.name = "Blub";
  const ai = nearAiSlimeMind(mindModel(), process.env.NEAR_AI_API_KEY);
  // Only Blub thinks on NEAR AI; the rest of town uses the free mind.
  const mind: Mind = { name: "mixed", decide: (ctx) => (ctx.slime.id === star.id ? ai.decide(ctx) : heuristicMind.decide(ctx)) };
  const found: Decision[] = [];
  while (found.length < 10 && world.tick < 400) {
    // Keep Blub rich, fed and loved so it thinks every tick.
    star.wallet = star.wallet < coins(500) ? coins(600) : star.wallet;
    star.energy = Math.max(star.energy, 70);
    star.lastCareTick = world.tick;
    star.job = null;
    const out = await runTick(world, { ...defaultMinds, slime: mind });
    const mine = out.decisions.filter((d) => d.actorId === star.id && d.source !== "rule");
    for (const d of mine) {
      found.push(d);
      await db().insert(decisions).values({ worldId: "mind-check", ...d });
    }
  }
  for (const [i, d] of found.slice(0, 10).entries()) {
    console.log(
      `${String(i + 1).padStart(2)}. ${d.action}${d.target ? ` ${d.target}` : ""} · cost ${formatCoins(d.cost)} · ${d.verified ? "VERIFIED" : `not verified (${String(d.proof?.check ?? d.proof?.fallback ?? "")})`} · ${d.source}\n    "${d.reason}"${d.say ? `  says: "${d.say}"` : ""}`,
    );
  }
  const verified = found.slice(0, 10).filter((d) => d.verified).length;
  console.log(`\n${found.length >= 10 ? 10 : found.length} decisions logged, ${verified} verified.`);
  const sample = found.find((d) => d.verified)?.proof;
  if (sample) console.log(`Signer ${String(sample.signingAddress)} · TDX ${JSON.stringify(sample.attestation)}`);
  process.exit(found.length >= 10 && verified === 10 ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
