/**
 * Create a funded NEAR testnet account from the public faucet and write its
 * key into .env and .env.local (both git-ignored). The key is never printed.
 *
 *   pnpm tsx scripts/create-testnet-account.ts my-game.testnet NEAR_GAME
 *
 * The second argument is the env prefix: it writes <PREFIX>_ACCOUNT and
 * <PREFIX>_PRIVATE_KEY.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { KeyPair } from "near-api-js";
import { z } from "zod";

const FAUCET_URL = "https://helper.nearprotocol.com/account";

const args = z
  .tuple([z.string().regex(/^[a-z0-9_-]+\.testnet$/), z.string().regex(/^[A-Z_]+$/)])
  .parse(process.argv.slice(2));

function setEnv(file: string, key: string, value: string) {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) lines[idx] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  writeFileSync(file, lines.join("\n"));
}

async function main() {
  const [accountId, prefix] = args;
  const keyPair = KeyPair.fromRandom("ed25519");
  const res = await fetch(FAUCET_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: keyPair.getPublicKey().toString() }),
  });
  if (!res.ok) throw new Error(`Faucet said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  for (const file of [".env", ".env.local"]) {
    setEnv(file, `${prefix}_ACCOUNT`, accountId);
    setEnv(file, `${prefix}_PRIVATE_KEY`, keyPair.toString());
  }
  console.log(`Created ${accountId}. Key saved to .env and .env.local.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
