"use client";

import { Copy, Share2, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorNote, Loading } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { ClanRank, ClanView } from "@/server/clans";
import { formatBits } from "@/lib/format";
import { post, usePoll } from "@/lib/use-poll";

type Data = { ok: boolean; inviteCode: string; inviteGift: string; clan: ClanView; clans: ClanRank[] };

async function shareLink(url: string, text: string, toast: (m: string) => void) {
  if (navigator.share) await navigator.share({ title: "Slimeworld", text, url }).catch(() => undefined);
  else {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    toast("Link copied!");
  }
}

/** Invite friends and play in a clan. */
export function FriendsPanel() {
  const toast = useToast();
  const { data, error, refresh } = usePoll<Data>("/api/friends", 20_000);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function clan(body: Record<string, unknown>) {
    setBusy(true);
    const r = await post<{ ok: boolean; message?: string; error?: string }>("/api/clan", body);
    setBusy(false);
    toast(r.ok ? (r.message ?? "Done!") : (r.error ?? "That didn't work."), r.ok ? undefined : "error");
    if (r.ok) {
      setName("");
      setCode("");
      await refresh();
    }
  }

  if (error && !data) return <ErrorNote message="Friends didn't load." onRetry={refresh} />;
  if (!data) return <Loading label="Finding your friends…" />;
  const invite = `${window.location.origin}/?ref=${data.inviteCode}`;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-2xl bg-bg-soft p-3">
        <p className="font-semibold">Invite a friend</p>
        <p className="text-sm text-ink-soft">When they hatch their first slime, you both get 🪙 {formatBits(data.inviteGift)} coins.</p>
        <div className="flex gap-2">
          <Button onClick={() => shareLink(invite, "Come raise a slime with me in Slimeworld!", toast)}>
            <Share2 size={18} /> Share invite
          </Button>
          <Button
            tone="soft"
            onClick={async () => {
              await navigator.clipboard?.writeText(invite).catch(() => undefined);
              toast("Link copied!");
            }}
          >
            <Copy size={18} /> Copy
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Users size={18} /> Your clan
        </p>
        {data.clan ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg font-semibold">{data.clan.name}</span>
              <button type="button" className="text-sm text-ink-soft underline" disabled={busy} onClick={() => clan({ action: "leave" })}>
                Leave
              </button>
            </div>
            <p className="text-sm">
              Join code: <b className="font-mono tracking-widest">{data.clan.code}</b>
            </p>
            <Button tone="soft" onClick={() => shareLink(invite, `Join my clan "${data.clan!.name}" in Slimeworld! Code: ${data.clan!.code}`, toast)}>
              <Share2 size={18} /> Invite to clan
            </Button>
            <ul className="flex flex-col gap-1.5">
              {data.clan.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <b>{m.name}</b> {m.slimes.length ? <span className="text-ink-soft">· {m.slimes.join(", ")}</span> : null}
                  </span>
                  <span className="shrink-0">🪙 {formatBits(m.coins)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-bg-soft p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 3) void clan({ action: "create", name: name.trim() });
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="New clan name" aria-label="New clan name" className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2" />
              <Button type="submit" disabled={busy || name.trim().length < 3}>
                Found
              </Button>
            </form>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (/^[0-9a-z]{6}$/.test(code)) void clan({ action: "join", code });
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^0-9a-z]/g, "").slice(0, 6))} placeholder="Clan code" aria-label="Clan code" className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 font-mono tracking-widest" />
              <Button type="submit" tone="soft" disabled={busy || code.length !== 6}>
                Join
              </Button>
            </form>
          </div>
        )}
      </section>

      {data.clans.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <p className="font-semibold">Top clans</p>
          {data.clans.map((c) => (
            <div key={c.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${c.mine ? "bg-accent/15" : "bg-bg-soft"}`}>
              <span className="min-w-0 truncate">
                <b>
                  {c.rank}. {c.name}
                </b>{" "}
                <span className="text-ink-soft">
                  · {c.members} keeper{c.members === 1 ? "" : "s"}
                </span>
              </span>
              <span className="shrink-0">🪙 {formatBits(c.coins)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
