"use client";

/**
 * Email and Google sign in through Privy. Loaded only when the player opens
 * the sign-in sheet, so the first page never downloads Privy. No crypto
 * wallets are offered or created: the game makes the player's NEAR account.
 */
import { PrivyProvider, useIdentityToken, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export type LoginStatus = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "error"; text: string };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as { ok: boolean; error?: string };
}

function LoginButton({ onStatus }: { onStatus: (s: LoginStatus) => void }) {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();
  const sent = useRef(false);

  useEffect(() => {
    if (!ready || !authenticated || sent.current) return;
    sent.current = true;
    void (async () => {
      onStatus({ kind: "busy", text: "Getting your egg ready…" });
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
      {ready ? "Play with email or Google" : "Loading…"}
    </button>
  );
}

export default function PrivyLogin({ appId, onStatus }: { appId: string; onStatus: (s: LoginStatus) => void }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { landingHeader: "Sign in to Slimeworld", showWalletLoginFirst: false, walletList: [] },
        embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "off" } },
      }}
    >
      <LoginButton onStatus={onStatus} />
    </PrivyProvider>
  );
}
