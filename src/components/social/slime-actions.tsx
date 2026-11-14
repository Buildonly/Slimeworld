"use client";

import { Gift, Heart, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { post } from "@/lib/use-poll";

/** Cheer, gift and share another player's slime. */
export function SlimeActions({ slimeId, name, canGift, canCheer = true, signedIn, giftMax, onDone }: { slimeId: string; name: string; canGift: boolean; canCheer?: boolean; signedIn: boolean; giftMax: number; onDone?: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [giving, setGiving] = useState(false);
  const [amount, setAmount] = useState("");

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    const r = await post<{ ok: boolean; message?: string; error?: string }>("/api/social", { slimeId, ...body });
    setBusy(false);
    toast(r.ok ? (r.message ?? "Done!") : (r.error ?? "That didn't work."), r.ok ? undefined : "error");
    if (r.ok) {
      setGiving(false);
      setAmount("");
      onDone?.();
    }
  }

  async function share() {
    const url = `${window.location.origin}/slime/${slimeId}`;
    const text = `Meet ${name} in Slimeworld!`;
    if (navigator.share) await navigator.share({ title: name, text, url }).catch(() => undefined);
    else {
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      toast("Link copied!");
    }
  }

  const n = Number(amount);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {signedIn && canCheer && (
          <Button tone="soft" disabled={busy} onClick={() => send({ action: "cheer" })}>
            <Heart size={18} /> Cheer
          </Button>
        )}
        {signedIn && canGift && (
          <Button tone="coin" disabled={busy} onClick={() => setGiving((v) => !v)}>
            <Gift size={18} /> Gift coins
          </Button>
        )}
        <Button tone="soft" onClick={share}>
          <Share2 size={18} /> Share
        </Button>
      </div>
      {giving && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (Number.isInteger(n) && n > 0 && n <= giftMax) void send({ action: "gift", amount: n });
          }}
        >
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder={`1 to ${giftMax}`}
            aria-label={`Coins to give ${name}`}
            className="w-28 rounded-xl border border-line bg-card px-3 py-2"
          />
          <Button tone="coin" type="submit" disabled={busy || !(n > 0 && n <= giftMax)}>
            Send
          </Button>
        </form>
      )}
      {!signedIn && <p className="text-sm text-ink-soft">Play to cheer and send gifts.</p>}
    </div>
  );
}
