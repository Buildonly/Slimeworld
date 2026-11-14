/**
 * Make (or reuse) the key for the game treasury on NEAR mainnet: an implicit
 * account, which costs nothing to create. Top ups land in its NEAR Intents
 * balance, so it needs no NEAR to start. Writes TOPUP_TREASURY_ACCOUNT and
 * the key to the git-ignored env files; only the public account id is printed.
 *   pnpm treasury:key
 */
import "dotenv/config";
import { KeyPair, type KeyPairString } from "near-api-js";
import { setEnv } from "./script-env";

const existing = process.env.TOPUP_TREASURY_PRIVATE_KEY as KeyPairString | undefined;
const kp = existing ? KeyPair.fromString(existing) : KeyPair.fromRandom("ed25519");
const account = Buffer.from(kp.getPublicKey().data).toString("hex");
setEnv("TOPUP_TREASURY_PRIVATE_KEY", kp.toString());
setEnv("TOPUP_TREASURY_ACCOUNT", account);
console.log(`Treasury account: ${account}`);
