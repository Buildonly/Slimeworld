export function StatBar({ label, value, colour, icon }: { label: string; value: number; colour: string; icon: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>
          {icon} {label}
        </span>
        <span className="text-ink-soft">{value}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-bg-soft" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(3, value)}%`, background: colour }} />
      </div>
    </div>
  );
}
