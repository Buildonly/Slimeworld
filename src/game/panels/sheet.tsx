"use client";

import { X } from "lucide-react";

/** In-game panel: slides up over the world, the world stays visible behind. */
export function GameSheet({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[78dvh] w-full ${wide ? "max-w-3xl" : "max-w-md"} animate-[pop_.2s_ease-out] overflow-y-auto rounded-t-[28px] border border-white/40 bg-card/95 p-5 shadow-2xl backdrop-blur md:rounded-[28px]`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-soft">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
