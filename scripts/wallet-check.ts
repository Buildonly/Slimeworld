/**
 * Check wallet linking and NFT moving end to end on testnet, against a
 * running server (CHECK_BASE_URL, default the local dev server). A throwaway
 * account stands in for the player's own wallet and signs exactly as a
 * wallet does (NEP-413).
 *   pnpm dev   (in another terminal)
 *   pnpm tsx --tsconfig tsconfig.json scripts/wallet-check.ts
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { Account, JsonRpcProvider, KeyPair, type KeyPairString } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { accessKeyBytes, chainPrices, storageCost } from "../src/near/costs";
import { required } from "./script-env";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
let cookie = "";
async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0] ?? cookie;
  return (await res.json()) as T;
}

async function main() {
  const gameId = required("NEAR_GAME_ACCOUNT");
  const provider = new JsonRpcProvider({ url: required("NEAR_RPC_URL") });
  const game = new Account(gameId, provider, required("NEAR_GAME_PRIVATE_KEY") as KeyPairString);
  const p = await chainPrices(provider);
  const kp = KeyPair.fromRandom("ed25519");
  const walletId = `w-${randomBytes(3).toString("hex")}.${gameId}`;
  await game.createAccount({ newAccountId: walletId, publicKey: kp.getPublicKey(), nearToTransfer: storageCost(p, accessKeyBytes(p)) });
  console.log(`Stand-in wallet: ${walletId}`);

  await call("/api/session/dev", { email: `wallet-${Date.now()}@example.com` });
  const hatched = await call<{ slimeId: string }>("/api/slimes", { name: "Nori", colour: "crystal" });
  // Wait until the slime and its NFT are on chain.
  for (let i = 0; i < 40; i++) {
    const s = await call<{ slimes: { slimeId: string; ready: boolean }[] }>("/api/wallet");
    if (s.slimes.find((x) => x.slimeId === hatched.slimeId)?.ready) break;
    await call("/api/status");
    await new Promise((r) => setTimeout(r, 4000));
  }

  const signer = new Account(walletId, provider, kp.toString() as KeyPairString);
  const sign = async () => {
    const c = await call<{ message: string; recipient: string; nonce: string }>("/api/wallet/challenge", {});
    const signed = await signMessage({ signerAccount: signer, payload: { message: c.message, recipient: c.recipient, nonce: new Uint8Array(Buffer.from(c.nonce, "base64")) } });
    return { accountId: walletId, publicKey: signed.publicKey.toString(), signature: Buffer.from(signed.signature).toString("base64"), nonce: c.nonce };
  };

  // Each signed message works once, so every attempt gets a fresh one.
  const wrong = await call<{ ok: boolean; error?: string }>("/api/wallet/link", { ...(await sign()), accountId: gameId });
  const answer = await sign();
  console.log(`Link with someone else's name: ${wrong.ok ? "ACCEPTED (bad)" : `refused (${wrong.error})`}`);
  const linked = await call<{ ok: boolean; wallet?: string; error?: string }>("/api/wallet/link", answer);
  console.log(`Link: ${linked.ok ? `linked ${linked.wallet}` : linked.error}`);
  const replay = await call<{ ok: boolean; error?: string }>("/api/wallet/link", answer);
  console.log(`Same signature again: ${replay.ok ? "ACCEPTED (bad)" : `refused (${replay.error})`}`);

  const moved = await call<{ ok: boolean; message?: string; error?: string; tx?: string }>("/api/wallet/move", { slimeId: hatched.slimeId });
  console.log(`Move NFT: ${moved.ok ? moved.message : moved.error}${moved.tx ? ` (tx ${moved.tx})` : ""}`);
  const after = await call<{ wallet: string; slimes: { slimeId: string; holder: string | null }[] }>("/api/wallet");
  const holder = after.slimes.find((s) => s.slimeId === hatched.slimeId)?.holder;
  const ok = linked.ok && !wrong.ok && !replay.ok && holder === walletId;
  console.log(`NFT holder on chain: ${holder}`);
  console.log(ok ? "\nPASS: wallet proven by signature, replay refused, slime NFT now in the player's own wallet." : "\nFAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
