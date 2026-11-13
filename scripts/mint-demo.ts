/**
 * Testnet check for step 3: mint a slime NFT and an item, give the slime
 * coins, and show the town contract enforcing the owner's rules.
 *
 *   pnpm tsx scripts/mint-demo.ts <player account id>
 */
import "dotenv/config";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { YOCTO_PER_COIN } from "../src/economy/config";
import { contractIds } from "../src/near/contracts";

const coins = (n: number) => (BigInt(n) * YOCTO_PER_COIN).toString();

async function main() {
  const [playerId] = z.tuple([z.string().min(2)]).parse(process.argv.slice(2));
  const gameId = z.string().parse(process.env.NEAR_GAME_ACCOUNT);
  const key = z.string().parse(process.env.NEAR_GAME_PRIVATE_KEY) as KeyPairString;
  const provider = new JsonRpcProvider({ url: process.env.NEAR_RPC_URL ?? "https://test.rpc.fastnear.com" });
  const game = new Account(gameId, provider, key);
  const ids = contractIds(gameId);
  const gas = teraToGas("50");
  const tag = randomBytes(3).toString("hex");
  const slimeId = `s-${tag}.${gameId}`;
  const keeperId = `k-bakery-${tag}.${gameId}`;
  const publicKey = KeyPair.fromString(key).getPublicKey();

  for (const id of [slimeId, keeperId]) {
    await game.createAccount({ newAccountId: id, publicKey, nearToTransfer: 10n ** 22n });
  }
  console.log(`Slime account: ${slimeId}`);

  await game.callFunction({
    contractId: ids.nft,
    methodName: "mint_slime",
    args: {
      token_id: tag,
      owner_id: playerId,
      slime_account: slimeId,
      name: "Blub",
      traits_json: JSON.stringify({ colour: "green", personality: "thrifty", size: 1 }),
    },
    gas,
  });
  const token = await provider.callFunction<{ owner_id: string; metadata: { title: string; extra: string } }>({
    contractId: ids.nft,
    method: "nft_token",
    args: { token_id: tag },
  });
  console.log(`Minted slime NFT "${token?.metadata.title}" (${tag}) owned by ${token?.owner_id}`);

  await game.callFunction({
    contractId: ids.items,
    methodName: "mint_batch",
    args: { owner_id: slimeId, token_ids: ["berries"], amounts: ["3"], memo: "starter snack" },
    gas,
  });
  const berries = await provider.callFunction<string>({
    contractId: ids.items,
    method: "mt_balance_of",
    args: { account_id: slimeId, token_id: "berries" },
  });
  console.log(`Minted item: slime holds ${berries} berries (NEP-245)`);

  await game.callFunction({
    contractId: ids.town,
    methodName: "register_slime",
    args: { slime_id: slimeId, owner_id: playerId, rules: { daily_limit: coins(100), allowed: ["Food"], savings_target: coins(50) } },
    gas,
  });
  await game.callFunction({ contractId: ids.town, methodName: "open_shop", args: { shop_id: `bakery-${tag}`, keeper_id: keeperId }, gas });
  await game.callFunction({ contractId: ids.town, methodName: "deposit", args: { account_id: slimeId }, deposit: coins(200), gas });

  const results = await game.callFunction<boolean[]>({
    contractId: ids.town,
    methodName: "settle_batch",
    args: {
      ops: [
        { from: slimeId, to: keeperId, amount: coins(8), kind: { Spend: { category: "Food", emergency: false } }, memo: "berries" },
        { from: slimeId, to: keeperId, amount: coins(60), kind: { Spend: { category: "Hat", emergency: false } }, memo: "party hat" },
        { from: slimeId, to: keeperId, amount: coins(150), kind: { Spend: { category: "Food", emergency: false } }, memo: "feast" },
      ],
    },
    gas,
  });
  console.log(`Town settled: buy berries=${results?.[0]}, buy hat (not allowed)=${results?.[1]}, feast (over daily limit)=${results?.[2]}`);
  const left = await provider.callFunction<string>({ contractId: ids.town, method: "balance_of", args: { account_id: slimeId } });
  console.log(`Slime coins left: ${BigInt(left ?? "0") / YOCTO_PER_COIN}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
