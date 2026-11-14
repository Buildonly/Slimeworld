/**
 * Run the town headless and print price charts and wealth spread.
 *   pnpm sim --days 30 --slimes 200 [--seed 7]
 * Exits with an error if a balancing check fails.
 */
import { z } from "zod";
import { TICKS_PER_DAY } from "@/economy/config";
import { runTick } from "@/economy/tick";
import type { GameEvent } from "@/economy/types";
import { createTown } from "@/economy/world";
import { checks, report } from "./report";

const argsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  slimes: z.coerce.number().int().min(1).max(5000).default(200),
  seed: z.coerce.number().int().default(7),
});

function parseArgs(argv: string[]) {
  const raw: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value !== undefined && argv[i]?.startsWith("--")) raw[key] = value;
  }
  return argsSchema.parse(raw);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const world = createTown(args.seed, args.slimes);
  const events: GameEvent[] = [];
  const started = Date.now();
  for (let t = 0; t < args.days * TICKS_PER_DAY; t++) events.push(...(await runTick(world)).events);
  console.log(report(world, events));
  console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
  const results = checks(world, events);
  for (const c of results) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`);
  if (results.some((c) => !c.ok)) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
