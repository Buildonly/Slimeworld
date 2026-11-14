/**
 * Price a top up with a live 1Click quote (dry: no deposit address, no money).
 * The coin and amount are yours to choose; nothing is assumed.
 *   pnpm tsx --tsconfig tsconfig.json scripts/topup-quote-check.ts <SYMBOL> <CHAIN> <amount>
 * Delivered (on paper) to NEAR_GAME_ACCOUNT, which must be registered on wrapped NEAR.
 */
import "dotenv/config";
import { liveTokens, parseUnits } from "@/topup/assets";
import { quote } from "@/topup/oneclick";

async function main() {
  const [symbol, chain, amount] = process.argv.slice(2);
  const recipient = process.env.NEAR_GAME_ACCOUNT;
  if (!symbol || !chain || !amount || !recipient) throw new Error("Usage: <SYMBOL> <CHAIN> <amount>, with NEAR_GAME_ACCOUNT set");
  const { coins } = await liveTokens();
  const coin = coins.find((c) => c.symbol.toLowerCase() === symbol.toLowerCase() && c.chain.toLowerCase() === chain.toLowerCase());
  if (!coin) throw new Error(`1Click lists no ${symbol} on ${chain} right now`);
  const units = parseUnits(amount, coin.decimals);
  if (!units) throw new Error("Bad amount");
  const q = await quote({ originAsset: coin.assetId, amount: units, recipient, dry: true });
  console.log(`${amount} ${coin.label} -> ${q.quote.amountOutFormatted} NEAR (~$${q.quote.amountInUsd ?? "?"}), about ${q.quote.timeEstimate}s`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
