/**
 * Create a funded NEAR testnet account from the public faucet and write its
 * key into .env and .env.local (both git-ignored). The key is never printed.
 *
 *   NEAR_FAUCET_URL=<faucet> pnpm tsx scripts/create-testnet-account.ts <name>.testnet NEAR_GAME
 *
 * The second argument is the env prefix: it writes <PREFIX>_ACCOUNT and
 * <PREFIX>_PRIVATE_KEY.
 */
import "dotenv/config";
import { KeyPair } from "near-api-js";
import { z } from "zod";
import { required, setEnv as writeEnv } from "./script-env";

const args = z
  .tuple([z.string().regex(/^[a-z0-9_-]+\.testnet$/), z.string().regex(/^[A-Z_]+$/)])
  .parse(process.argv.slice(2));


async function main() {
  const [accountId, prefix] = args;
  const keyPair = KeyPair.fromRandom("ed25519");
  const res = await fetch(required("NEAR_FAUCET_URL"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: keyPair.getPublicKey().toString() }),
  });
  if (!res.ok) throw new Error(`Faucet said ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeEnv(`${prefix}_ACCOUNT`, accountId, [".env", ".env.local"]);
  writeEnv(`${prefix}_PRIVATE_KEY`, keyPair.toString(), [".env", ".env.local"]);
  console.log(`Created ${accountId}. Key saved to .env and .env.local.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
