/**
 * Open the town on NEAR mainnet, step one: claim the game's name.
 *
 * 1. Waits until the funding address (from scripts/new-mainnet-key.ts) holds NEAR.
 * 2. Creates <GAME_NAME> (default slimeworld.near) through the `near` registrar
 *    with a fresh game key, moving the funds into it.
 * 3. Writes .env.mainnet (git-ignored): the testnet settings with mainnet
 *    values for the network, RPC, game account, key and a separate database.
 * Keys are never printed. Then run, with DOTENV_CONFIG_PATH=.env.mainnet:
 *   pnpm contracts:deploy && pnpm chain:setup
 *
 *   pnpm tsx scripts/mainnet-bootstrap.ts [name.near]
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";

const RPC = "https://free.rpc.fastnear.com";
const GAME_NAME = process.argv[2] ?? "slimeworld.near";
/** Left in the funding account for the create_account gas. */
const KEEP_FOR_GAS = 5n * 10n ** 22n; // 0.05 NEAR
const MIN_FUNDING = 9n * 10n ** 24n; // 9 NEAR

function readEnv(file: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(file)) return map;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) map.set(line.slice(0, i), line.slice(i + 1));
  }
  return map;
}

function writeEnv(file: string, map: Map<string, string>) {
  writeFileSync(file, [...map.entries()].map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}

const near = (yocto: bigint) => (Number(yocto / 10n ** 21n) / 1000).toFixed(3);

async function main() {
  const funderKey = process.env.MAINNET_FUNDER_PRIVATE_KEY as KeyPairString | undefined;
  if (!funderKey) throw new Error("Run scripts/new-mainnet-key.ts first.");
  const provider = new JsonRpcProvider({ url: RPC });
  const funderKp = KeyPair.fromString(funderKey);
  const funderId = Buffer.from(funderKp.getPublicKey().data).toString("hex");
  const funder = new Account(funderId, provider, funderKey);

  let balance = 0n;
  try {
    balance = await funder.getBalance();
  } catch {
    balance = 0n;
  }
  console.log(`Funding address ${funderId} holds ${near(balance)} NEAR.`);

  const mainnet = readEnv(".env.mainnet");
  const exists = await provider.viewAccount({ accountId: GAME_NAME }).then(() => true, () => false);
  if (!exists) {
    if (balance < MIN_FUNDING) {
      console.log(`Waiting for at least ${near(MIN_FUNDING)} NEAR before opening ${GAME_NAME}.`);
      process.exit(2);
    }
    const gameKp = mainnet.get("NEAR_GAME_PRIVATE_KEY") ? KeyPair.fromString(mainnet.get("NEAR_GAME_PRIVATE_KEY") as KeyPairString) : KeyPair.fromRandom("ed25519");
    mainnet.set("NEAR_GAME_PRIVATE_KEY", gameKp.toString());
    writeEnv(".env.mainnet", mainnet); // save the key before anything is sent
    await funder.callFunction({
      contractId: "near",
      methodName: "create_account",
      args: { new_account_id: GAME_NAME, new_public_key: gameKp.getPublicKey().toString() },
      deposit: balance - KEEP_FOR_GAS,
      gas: teraToGas("100"),
    });
    console.log(`Created ${GAME_NAME}.`);
  } else if (!mainnet.get("NEAR_GAME_PRIVATE_KEY")) {
    throw new Error(`${GAME_NAME} already exists and this machine has no key for it.`);
  }

  // Start from the current settings, then switch everything network-specific.
  const base = readEnv(".env");
  for (const [k, v] of base) if (!mainnet.has(k)) mainnet.set(k, v);
  mainnet.set("NEAR_NETWORK", "mainnet");
  mainnet.set("NEAR_RPC_URL", RPC);
  mainnet.set("NEAR_GAME_ACCOUNT", GAME_NAME);
  mainnet.set("DATABASE_URL", (base.get("DATABASE_URL") ?? "").replace(/\/slimeworld$/, "/slimeworld_mainnet"));
  // The testnet relayer is not ours on mainnet; chain:setup makes relayer.<game>.
  if (!(mainnet.get("NEAR_RELAYER_ACCOUNT") ?? "").endsWith(`.${GAME_NAME}`)) {
    mainnet.delete("NEAR_RELAYER_ACCOUNT");
    mainnet.delete("NEAR_RELAYER_PRIVATE_KEY");
  }
  mainnet.delete("MAINNET_FUNDER_PRIVATE_KEY");
  writeEnv(".env.mainnet", mainnet);
  const game = new Account(GAME_NAME, provider);
  console.log(`${GAME_NAME} holds ${near(await game.getBalance())} NEAR. Wrote .env.mainnet.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
