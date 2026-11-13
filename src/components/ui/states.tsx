/** Every state has a look: loading, empty, error. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-ink-soft">
      <div className="h-10 w-14 animate-bounce rounded-[50%_50%_42%_42%] bg-accent/50" />
      <p>{label}</p>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="text-ink-soft">{children}</div>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-danger">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-xl bg-danger px-3 py-1 text-sm font-semibold text-white">
          Try again
        </button>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-card p-4 shadow-[0_2px_0_var(--line)] ${className}`}>{children}</section>;
}
