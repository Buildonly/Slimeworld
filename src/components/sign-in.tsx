"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { privyEnabled } from "./providers";

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as { ok: boolean; error?: string };
}

/** Email or Google sign in through Privy, then swap for our own session. */
function PrivySignIn({ onStatus }: { onStatus: (s: Status) => void }) {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const sent = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || sent.current) return;
    sent.current = true;
    void (async () => {
      onStatus({ kind: "busy", text: "Making your town account…" });
      const accessToken = await getAccessToken();
      const res = await postJson("/api/session", { accessToken, identityToken });
      if (!res.ok) {
        sent.current = false;
        onStatus({ kind: "error", text: res.error ?? "Sign in failed." });
        return;
      }
      router.refresh();
    })();
  }, [ready, authenticated, getAccessToken, identityToken, onStatus, router]);

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => login()}
      className="w-full rounded-2xl bg-accent px-5 py-4 text-lg font-semibold text-accent-ink shadow-[0_4px_0_rgba(0,0,0,0.15)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
    >
      {ready ? "Sign in with email or Google" : "Loading…"}
    </button>
  );
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
        onStatus({ kind: "busy", text: "Making your town account…" });
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
        aria-label="Email for test sign in"
        className="min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 py-3 text-ink placeholder:text-ink-soft"
      />
      <button type="submit" className="rounded-2xl border border-line bg-bg-soft px-4 py-3 font-medium">
        Test play
      </button>
    </form>
  );
}

export function SignIn({ devLogin }: { devLogin: boolean }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  return (
    <div className="flex w-full flex-col items-center gap-3">
      {privyEnabled && <PrivySignIn onStatus={setStatus} />}
      {devLogin && <DevSignIn onStatus={setStatus} />}
      {!privyEnabled && !devLogin && <p className="text-ink-soft">Sign in is not set up yet.</p>}
      <p role="status" aria-live="polite" className={status.kind === "error" ? "text-danger" : "text-ink-soft"}>
        {status.kind === "idle" ? "No wallet or seed phrase needed." : status.text}
      </p>
    </div>
  );
}
