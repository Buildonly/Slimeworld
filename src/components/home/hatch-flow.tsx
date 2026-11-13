"use client";

import { useState } from "react";
import { post } from "@/lib/use-poll";
import { Button } from "@/components/ui/button";

const NAMES = ["Blub", "Mochi", "Wobble", "Pudding", "Gloop", "Boba", "Jiggles", "Fizz"];

/** Name your egg and hatch it. The colour is a surprise (rarer colours are rarer). */
export function HatchFlow({ onHatched }: { onHatched: () => void }) {
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)] ?? "Blub");
  const [state, setState] = useState<"idle" | "cracking" | "error">("idle");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6 text-center">
      <h1 className="text-3xl font-semibold">Your egg is ready!</h1>
      <p className="text-ink-soft">Every slime earns its own living. Give yours a name and hatch it.</p>
      <div className={`relative h-48 w-40 ${state === "cracking" ? "animate-[crack_.15s_linear_infinite]" : "animate-[wobble_2.4s_ease-in-out_infinite]"}`} aria-hidden="true">
        <svg viewBox="0 0 160 192" className="h-full w-full drop-shadow-[0_10px_0_var(--line)]">
          <ellipse cx="80" cy="104" rx="70" ry="84" fill="#fff6e8" stroke="var(--line)" strokeWidth="4" />
          <circle cx="52" cy="84" r="10" fill="var(--accent)" opacity=".7" />
          <circle cx="104" cy="122" r="14" fill="#ff8fc7" opacity=".6" />
          <circle cx="98" cy="62" r="7" fill="#5aa9ff" opacity=".6" />
          <circle cx="60" cy="140" r="8" fill="var(--coin)" opacity=".7" />
          <ellipse cx="58" cy="56" rx="16" ry="9" fill="#fff" opacity=".8" transform="rotate(-30 58 56)" />
        </svg>
      </div>
      <form
        className="flex w-full flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("cracking");
          const r = await post("/api/slimes", { name });
          if (!r.ok) {
            setState("error");
            setError(r.error ?? "The egg would not hatch. Try again.");
            return;
          }
          setTimeout(onHatched, 900);
        }}
      >
        <label className="text-left text-sm text-ink-soft" htmlFor="slime-name">
          Name
        </label>
        <input
          id="slime-name"
          value={name}
          maxLength={16}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border border-line bg-card px-4 py-3 text-center text-xl"
        />
        <Button type="submit" size="lg" disabled={!name.trim() || state === "cracking"}>
          {state === "cracking" ? "Hatching…" : "Hatch!"}
        </Button>
        {state === "error" && <p className="text-danger">{error}</p>}
      </form>
    </div>
  );
}
