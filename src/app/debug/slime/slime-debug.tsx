"use client";

import { useState } from "react";
import { SLIME_COLOURS, SLIME_STATES, type SlimeColour, type SlimeState } from "@/components/slime/look";
import type { Reaction } from "@/components/slime/slime-model";
import { SlimeView } from "@/components/slime/slime-view";

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-1 w-full text-sm text-ink-soft">{label}</legend>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className="rounded-full border border-line px-3 py-1.5 text-sm capitalize aria-pressed:bg-accent aria-pressed:text-accent-ink"
        >
          {o}
        </button>
      ))}
    </fieldset>
  );
}

/** Debug panel: switch a slime's state, colour and size, and play reactions. */
export function SlimeDebug() {
  const [state, setState] = useState<SlimeState>("fine");
  const [colour, setColour] = useState<SlimeColour>("green");
  const [size, setSize] = useState(1);
  const [reaction, setReaction] = useState<Reaction | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 md:flex-row md:items-center">
      <SlimeView state={state} colour={colour} size={size} reaction={reaction} className="aspect-square w-full md:w-1/2" />
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-card p-4 md:w-1/2">
        <h1 className="text-xl font-semibold">Slime debug</h1>
        <Chips label="State" options={SLIME_STATES} value={state} onChange={setState} />
        <Chips label="Colour" options={SLIME_COLOURS} value={colour} onChange={setColour} />
        <label className="flex flex-col gap-1 text-sm text-ink-soft">
          Size {size.toFixed(2)}
          <input type="range" min={0.8} max={1.4} step={0.05} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
        <div className="flex gap-2">
          {(["hop", "spin", "droop"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setReaction({ kind, id: Date.now() })}
              className="rounded-2xl bg-bg-soft px-4 py-2 capitalize"
            >
              {kind}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
