"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Forget the email or Google login kept in this browser, so the next sign in can pick another account. */
function forgetLogin() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("privy:")) localStorage.removeItem(k);
  } catch {
    // storage blocked: nothing kept to forget
  }
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name?.startsWith("privy-")) document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

/** Sign out. Guests are warned first: a guest's slime lives only in this session. */
export function SignOut({ guest, name }: { guest: boolean; name: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const out = async () => {
    setBusy(true);
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    forgetLogin();
    router.replace("/");
    router.refresh();
  };
  if (asking)
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-danger/40 bg-danger/10 p-3">
        <p className="font-semibold">Leave {name} behind?</p>
        <p className="text-sm text-ink-soft">You&apos;re a guest. If you sign out, you can&apos;t come back to {name}. Sign in with email above to keep it.</p>
        <div className="flex gap-2">
          <button type="button" className="flex-1 rounded-xl bg-bg-soft p-2" onClick={() => setAsking(false)}>
            Stay
          </button>
          <button type="button" disabled={busy} className="flex-1 rounded-xl bg-danger p-2 font-semibold text-white disabled:opacity-60" onClick={out}>
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  return (
    <button type="button" disabled={busy} className="flex items-center gap-2 rounded-2xl bg-bg-soft p-3 text-left disabled:opacity-60" onClick={() => (guest ? setAsking(true) : void out())}>
      <LogOut size={18} /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
