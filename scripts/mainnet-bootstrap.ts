/**
 * Open the town on NEAR mainnet, step one: claim the game's name.
 *
 *   MAINNET_RPC_URL=<rpc> pnpm mainnet:open <name.near>
 *
 * 1. Works out, live, what opening the town costs (see opening-cost.ts) and
 *    checks the funding address (from scripts/new-mainnet-key.ts) holds it.
 * 2. Creates <name> through its parent account's registrar with a fresh game
 *    key, moving everything except the create call's own gas into it.
 * 3. Writes .env.mainnet (git-ignored): the current settings with mainnet
 *    values for the network, RPC, game account, key and a separate database.
 * Keys are never printed. Then run, with DOTENV_CONFIG_PATH=.env.mainnet:
 *   pnpm contracts:deploy && pnpm chain:setup
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Account, JsonRpcProvider, KeyPair, teraToGas, type KeyPairString } from "near-api-js";
import { z } from "zod";
import { chainPrices, gasCost, receiptGas, shortfallFrom } from "../src/near/costs";
import { liveTokens } from "../src/topup/assets";
import { total, workOutCost } from "./opening-cost";
import { nearText, required } from "./script-env";

const CREATE_GAS = teraToGas("100");

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

/** Same server, a database of its own for mainnet: <name>_mainnet. */
function mainnetDatabase(url: string): string {
  const u = new URL(url);
  u.pathname = `${u.pathname.replace(/\/$/, "")}_mainnet`;
  return u.toString();
}

async function main() {
  const gameName = z.string().regex(/^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/).parse(process.argv[2]);
  const registrar = gameName.slice(gameName.indexOf(".") + 1);
  const rpc = required("MAINNET_RPC_URL");
  const funderKey = required("MAINNET_FUNDER_PRIVATE_KEY") as KeyPairString;
  const provider = new JsonRpcProvider({ url: rpc });
  const funderKp = KeyPair.fromString(funderKey);
  const funderId = Buffer.from(funderKp.getPublicKey().data).toString("hex");
  const funder = new Account(funderId, provider, funderKey);
  const prices = await chainPrices(provider);

  const balance = await funder.getBalance().catch(() => 0n);
  console.log(`Funding address ${funderId} holds ${nearText(balance)} NEAR.`);

  const mainnet = readEnv(".env.mainnet");
  const exists = await provider.viewAccount({ accountId: gameName }).then(() => true, () => false);
  if (!exists) {
    const wrappedNear = process.env.ONECLICK_URL ? ((await liveTokens()).destination.contractAddress ?? null) : null;
    const cost = await workOutCost({ prices, provider, network: "mainnet", gameId: gameName, wrappedNear });
    const createArgs = { new_account_id: gameName, new_public_key: funderKp.getPublicKey().toString() };
    const createGas = gasCost(prices, receiptGas(prices, { call: { argBytes: Buffer.byteLength(JSON.stringify(createArgs)), attachedGas: CREATE_GAS } }));
    const need = total(cost.opening) + createGas;
    if (balance < need) {
      console.log(`Opening ${gameName} needs ${nearText(need)} NEAR at today's prices (run pnpm chain:cost for the breakdown). Waiting for funds.`);
      process.exit(2);
    }
    const gameKp = mainnet.get("NEAR_GAME_PRIVATE_KEY") ? KeyPair.fromString(mainnet.get("NEAR_GAME_PRIVATE_KEY") as KeyPairString) : KeyPair.fromRandom("ed25519");
    mainnet.set("NEAR_GAME_PRIVATE_KEY", gameKp.toString());
    writeEnv(".env.mainnet", mainnet); // save the key before anything is sent
    const create = (deposit: bigint) =>
      funder.callFunction({
        contractId: registrar,
        methodName: "create_account",
        args: { new_account_id: gameName, new_public_key: gameKp.getPublicKey().toString() },
        deposit,
        gas: CREATE_GAS,
      });
    try {
      await create(balance - createGas);
    } catch (err) {
      // The chain says exactly how much short the gas money was; keep that back and try once more.
      const short = shortfallFrom(err);
      if (!short || short.accountId !== funderId) throw err;
      await create(balance - createGas - short.amount);
    }
    console.log(`Created ${gameName}.`);
  } else if (!mainnet.get("NEAR_GAME_PRIVATE_KEY")) {
    throw new Error(`${gameName} already exists and this machine has no key for it.`);
  }

  // Start from the current settings, then switch everything network-specific.
  const base = readEnv(".env");
  for (const [k, v] of base) if (!mainnet.has(k)) mainnet.set(k, v);
  mainnet.set("NEAR_NETWORK", "mainnet");
  mainnet.set("NEAR_RPC_URL", rpc);
  mainnet.set("NEAR_GAME_ACCOUNT", gameName);
  const db = base.get("DATABASE_URL");
  if (db) mainnet.set("DATABASE_URL", mainnetDatabase(db));
  // The testnet relayer is not ours on mainnet; chain:setup makes relayer.<game>.
  if (!(mainnet.get("NEAR_RELAYER_ACCOUNT") ?? "").endsWith(`.${gameName}`)) {
    mainnet.delete("NEAR_RELAYER_ACCOUNT");
    mainnet.delete("NEAR_RELAYER_PRIVATE_KEY");
  }
  mainnet.delete("MAINNET_FUNDER_PRIVATE_KEY");
  mainnet.delete("MAINNET_RPC_URL");
  writeEnv(".env.mainnet", mainnet);
  const game = new Account(gameName, provider);
  console.log(`${gameName} holds ${nearText(await game.getBalance())} NEAR. Wrote .env.mainnet.`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
