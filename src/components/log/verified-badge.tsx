"use client";

import { ShieldCheck, ShieldQuestion } from "lucide-react";
import { useState } from "react";

type Proof = Record<string, unknown> | null;

/** "Verified" badge for decisions made on NEAR AI Cloud, with the evidence on tap. */
export function VerifiedBadge({ verified, source, proof }: { verified: boolean | null; source: string; proof: Proof }) {
  const [open, setOpen] = useState(false);
  if (source === "rule") return <span className="rounded-full bg-bg-soft px-2 py-0.5 text-xs text-ink-soft">habit</span>;
  if (source === "owner") return <span className="rounded-full bg-bg-soft px-2 py-0.5 text-xs text-ink-soft">you</span>;
  if (source !== "near-ai") return <span className="rounded-full bg-bg-soft px-2 py-0.5 text-xs text-ink-soft">quick</span>;
  const att = (proof?.attestation ?? null) as { tcbStatus?: string; verifiedAt?: string } | null;
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${verified ? "bg-accent/15 text-accent" : "bg-coin/20 text-ink"}`}
      >
        {verified ? <ShieldCheck size={14} /> : <ShieldQuestion size={14} />}
        {verified ? "Verified" : "Unchecked"}
      </button>
      {open && (
        <span className="absolute right-0 z-30 mt-2 block w-72 rounded-2xl border border-line bg-card p-3 text-left text-xs shadow-xl">
          <span className="mb-1 block font-semibold">{verified ? "This thought came from a sealed, checked AI" : "We couldn't check this one"}</span>
          <span className="block text-ink-soft">{String(proof?.check ?? proof?.fallback ?? "")}</span>
          {proof?.model ? <span className="mt-2 block">Model: {String(proof.model)}</span> : null}
          {proof?.signingAddress ? <span className="block break-all">Signer: {String(proof.signingAddress)}</span> : null}
          {att?.tcbStatus ? <span className="block">Intel TDX: {att.tcbStatus}</span> : null}
          {proof?.chatId ? <span className="block break-all text-ink-soft">Answer id: {String(proof.chatId)}</span> : null}
          <a className="mt-2 inline-block text-accent underline" href="https://cloud.near.ai/verify" target="_blank" rel="noreferrer">
            How NEAR AI verification works
          </a>
        </span>
      )}
    </span>
  );
}
