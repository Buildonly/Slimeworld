"use client";

import { Check, Link2, Wallet } from "lucide-react";
import { useState } from "react";
import { NearMark } from "@/components/brand/near-logo";
import { Button } from "@/components/ui/button";
import { ErrorNote, Loading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { post, usePoll } from "@/lib/use-poll";

type Status = { ok: boolean; wallet: string | null; gameAccount: string | null; slimes: { slimeId: string; tokenId: string; ready: boolean; holder: string | null }[] };
type Challenge = { ok: boolean; message: string; recipient: string; nonce: string; error?: string };

const NETWORK = process.env.NEXT_PUBLIC_NEAR_NETWORK === "mainnet" ? "mainnet" : "testnet";

/** Link your own NEAR wallet (Meteor, HOT, Intear…) and keep your slime NFTs in it. */
export function WalletPanel({ names }: { names: Record<string, string> }) {
  const toast = useToast();
  const { data, error, refresh } = usePoll<Status>("/api/wallet", 20_000);
  const [busy, setBusy] = useState<string | null>(null);

  async function connect() {
    setBusy("connect");
    try {
      const { NearConnector } = await import("@hot-labs/near-connect");
      const connector = new NearConnector({ network: NETWORK, features: { signMessage: true } });
      const wallet = await connector.connect();
      const c = await post<Challenge>("/api/wallet/challenge", {});
      if (!c.ok) throw new Error(c.error ?? "Couldn't start.");
      const signed = await wallet.signMessage({ message: c.message, recipient: c.recipient, nonce: Uint8Array.from(atob(c.nonce), (ch) => ch.charCodeAt(0)), network: NETWORK });
      const r = await post<{ ok: boolean; wallet?: string; error?: string }>("/api/wallet/link", { accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, nonce: c.nonce });
      if (!r.ok) throw new Error(r.error ?? "Couldn't link that wallet.");
      toast(`Linked ${r.wallet}!`);
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!/reject|cancel|closed/i.test(msg)) toast(msg || "Couldn't connect your wallet.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function move(slimeId: string) {
    setBusy(slimeId);
    const r = await post<{ ok: boolean; message?: string; error?: string }>("/api/wallet/move", { slimeId });
    setBusy(null);
    toast(r.ok ? (r.message ?? "Moved!") : (r.error ?? "That didn't work."), r.ok ? undefined : "error");
    if (r.ok) await refresh();
  }

  if (error && !data) return <ErrorNote message="Your wallet info didn't load." onRetry={refresh} />;
  if (!data) return <Loading label="Checking your wallet…" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-2xl bg-bg-soft p-3">
        <NearMark className="mt-0.5 h-6 w-6 shrink-0" />
        <p className="text-sm text-ink-soft">
          Already have a NEAR wallet? Link it to keep your slimes in it. You can play without one: the game keeps a NEAR account for you{data.gameAccount ? ` (${data.gameAccount})` : ""}.
        </p>
      </div>
      {data.wallet ? (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            <Wallet size={18} className="shrink-0" /> <span className="truncate">{data.wallet}</span>
          </span>
          <button
            type="button"
            className="shrink-0 text-sm text-ink-soft underline"
            onClick={async () => {
              await fetch("/api/wallet", { method: "DELETE" });
              await refresh();
            }}
          >
            Unlink
          </button>
        </div>
      ) : (
        <Button size="lg" disabled={busy !== null} onClick={connect}>
          <Link2 size={20} /> {busy === "connect" ? "Waiting for your wallet…" : "Connect NEAR wallet"}
        </Button>
      )}
      {data.wallet && (
        <ul className="flex flex-col gap-2">
          {data.slimes.map((s) => {
            const inWallet = s.holder === data.wallet;
            return (
              <li key={s.slimeId} className="flex items-center justify-between gap-2 rounded-2xl bg-bg-soft p-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{names[s.slimeId] ?? "Your slime"}</span>
                  <span className="block text-xs text-ink-soft">{!s.ready ? "Still being set up…" : inWallet ? "NFT is in your wallet" : "NFT held by your game account"}</span>
                </span>
                {inWallet ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
                    <Check size={16} /> In wallet
                  </span>
                ) : (
                  <Button tone="soft" disabled={!s.ready || busy !== null} onClick={() => move(s.slimeId)}>
                    {busy === s.slimeId ? "Moving…" : "Move to wallet"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-ink-soft">Your slime keeps playing either way. Linking only needs a signature: no fee, nothing is sent.</p>
    </div>
  );
}
