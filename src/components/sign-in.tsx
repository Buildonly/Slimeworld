"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LoginStatus } from "./auth/privy-login";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
/** Privy loads only when this sheet opens, never on the first page. */
const PrivyLogin = dynamic(() => import("./auth/privy-login"), {
  ssr: false,
  loading: () => <div className="h-[60px] w-full animate-pulse rounded-2xl bg-accent/40" />,
});

type Status = LoginStatus;

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as { ok: boolean; error?: string };
}

/** Test sign in for local play: shown only when the server allows it. */
function DevSignIn({ onStatus }: { onStatus: (s: Status) => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  return (
    <form
      className="flex w-full gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        onStatus({ kind: "busy", text: "Getting your egg ready…" });
        const res = await postJson("/api/session/dev", { email });
        if (!res.ok) return onStatus({ kind: "error", text: res.error ?? "Sign in failed." });
        router.refresh();
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Your email"
        className="min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 py-3 text-ink placeholder:text-ink-soft"
      />
      <button type="submit" className="rounded-2xl border border-line bg-bg-soft px-4 py-3 font-medium">
        Play
      </button>
    </form>
  );
}

/** Play now with no account at all. */
function GuestSignIn({ onStatus }: { onStatus: (s: Status) => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-ink-soft underline underline-offset-4"
      onClick={async () => {
        onStatus({ kind: "busy", text: "Getting your egg ready…" });
        const res = await postJson("/api/session/guest", {});
        if (!res.ok) return onStatus({ kind: "error", text: res.error ?? "Couldn't start. Try again." });
        router.refresh();
      }}
    >
      or jump in as a guest
    </button>
  );
}

export function SignIn({ devLogin, guest = true }: { devLogin: boolean; guest?: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {privyAppId && <PrivyLogin appId={privyAppId} onStatus={setStatus} />}
      {devLogin && <DevSignIn onStatus={setStatus} />}
      {guest && <GuestSignIn onStatus={setStatus} />}
      <p role="status" aria-live="polite" className={status.kind === "error" ? "text-danger" : "text-ink-soft"}>
        {status.kind === "idle" ? "Free to play. No wallet app needed." : status.text}
      </p>
    </div>
  );
}
