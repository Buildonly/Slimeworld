"use client";

import { useState, useSyncExternalStore } from "react";
import { NearMark } from "@/components/brand/near-logo";

const SEEN = "slimeworld-welcome-seen";
const subscribe = () => () => undefined;
function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === "1";
  } catch {
    return true;
  }
}

/** Three short cards, once, right after hatching: what this is and what you do. */
export function Welcome({ name }: { name: string }) {
  const already = useSyncExternalStore(subscribe, seen, () => true);
  const [page, setPage] = useState(0);
  const [closed, setClosed] = useState(false);
  if (already || closed) return null;
  const cards = [
    { emoji: "🥚", title: `Meet ${name}!`, text: `${name} lives in this town. It earns, spends and saves coins all by itself, and it thinks with its own AI mind.` },
    { emoji: "🧡", title: "You're its keeper", text: "Feed it, play with it, send it to work and to races. Set rules for how it may spend. It can't break them." },
    { emoji: "⭐", title: "Follow the gold beam", text: "Your first day has 5 small steps. The card at the top shows the next one, and the gold beam shows where to go." },
  ];
  const c = cards[page]!;
  const close = () => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      // Private mode: they'll just see it again next time.
    }
    setClosed(true);
  };
  return (
    <div className="pointer-events-auto fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-4 md:items-center" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="w-full max-w-sm animate-[pop_.25s_ease-out] rounded-3xl bg-card p-6 text-center shadow-2xl">
        <p className="text-5xl" aria-hidden>
          {c.emoji}
        </p>
        <h2 className="mt-3 text-2xl font-semibold">{c.title}</h2>
        <p className="mt-2 text-ink-soft">{c.text}</p>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {cards.map((_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i === page ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (page < cards.length - 1 ? setPage(page + 1) : close())}
          className="mt-5 w-full rounded-2xl bg-accent px-5 py-3.5 text-lg font-semibold text-accent-ink"
        >
          {page < cards.length - 1 ? "Next" : "Let's go!"}
        </button>
        {page < cards.length - 1 && (
          <button type="button" onClick={close} className="mt-2 text-sm text-ink-soft underline">
            Skip
          </button>
        )}
        <p className="mt-4 inline-flex items-center gap-1 text-xs text-ink-soft">
          <NearMark className="h-3 w-3" /> Your slime and its coins live on NEAR. No fees, no wallet needed.
        </p>
      </div>
    </div>
  );
}
