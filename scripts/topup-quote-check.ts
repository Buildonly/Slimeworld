/**
 * Price a few top ups with live 1Click quotes (dry: no deposit address, no money).
 *   pnpm tsx --tsconfig tsconfig.json scripts/topup-quote-check.ts
 */
import "dotenv/config";
import { TOPUP_COINS, parseUnits } from "@/topup/assets";
import { quote } from "@/topup/oneclick";

/** Dry quotes need a recipient already registered on wrap.near. */
const PREVIEW_RECIPIENT = "intents.near";

const SAMPLES: [string, string][] = [
  ["usdc-base", "5"],
  ["usdc-arb", "2"],
  ["sol", "0.1"],
  ["eth-base", "0.002"],
];

async function main() {
  for (const [id, amount] of SAMPLES) {
    const coin = TOPUP_COINS.find((c) => c.id === id);
    const units = coin ? parseUnits(amount, coin.decimals) : null;
    if (!coin || units === null) continue;
    const q = await quote({
      originAsset: coin.assetId,
      amount: units,
      recipient: PREVIEW_RECIPIENT,
      dry: true,
    });
    console.log(`${amount} ${coin.label.padEnd(17)} -> ${q.quote.amountOutFormatted} NEAR (~$${q.quote.amountInUsd ?? "?"}), about ${q.quote.timeEstimate}s`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
