/**
 * Make a fresh mainnet key for the game and print only its public address
 * (an implicit account id) so it can be funded. The private key is written to
 * the git-ignored env files and never printed.
 *   pnpm tsx scripts/new-mainnet-key.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { KeyPair } from "near-api-js";

function setEnv(key: string, value: string) {
  for (const file of [".env", ".env.local"]) {
    const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
    const i = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
    writeFileSync(file, lines.join("\n"));
  }
}

const existing = readFileSync(".env", "utf8").match(/^MAINNET_FUNDER_PRIVATE_KEY=(ed25519:\w+)/m)?.[1];
const kp = existing ? KeyPair.fromString(existing as `ed25519:${string}`) : KeyPair.fromRandom("ed25519");
if (!existing) setEnv("MAINNET_FUNDER_PRIVATE_KEY", kp.toString());
const implicit = Buffer.from(kp.getPublicKey().data).toString("hex");
console.log(`Fund this NEAR mainnet address: ${implicit}`);
