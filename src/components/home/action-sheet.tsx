"use client";

import { X } from "lucide-react";

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="max-h-[80dvh] w-full max-w-lg animate-[pop_.2s_ease-out] overflow-y-auto rounded-t-3xl bg-card p-5 md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-bg-soft">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
