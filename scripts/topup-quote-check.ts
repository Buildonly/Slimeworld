/**
 * Price a few top ups with live 1Click quotes (dry: no deposit address, no money).
 *   pnpm tsx --tsconfig tsconfig.json scripts/topup-quote-check.ts
 */
import "dotenv/config";
import { TOPUP_COINS, parseUnits } from "@/topup/assets";
import { quote } from "@/topup/oneclick";

const REFUND: Record<string, string> = {
  Solana: "11111111111111111111111111111111",
  Bitcoin: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  NEAR: "slimeworld.near",
};

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
      recipient: "slimeworld.near",
      refundTo: REFUND[coin.chain] ?? "0x0000000000000000000000000000000000000001",
      dry: true,
    });
    console.log(`${amount} ${coin.label.padEnd(17)} -> ${q.quote.amountOutFormatted} NEAR (~$${q.quote.amountInUsd ?? "?"}), about ${q.quote.timeEstimate}s`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
