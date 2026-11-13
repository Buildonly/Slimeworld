import { MOOD } from "@/lib/format";

const ORDER = ["thriving", "fine", "hungry", "broke", "asleep"] as const;
const COLOURS: Record<string, string> = { thriving: "var(--accent)", fine: "#7cc4f0", hungry: "var(--coin)", broke: "var(--danger)", asleep: "#a9a9b3" };

/** How every slime in town is doing, as one stacked bar. */
export function MoodsBar({ states }: { states: Record<string, number> }) {
  const total = ORDER.reduce((a, k) => a + (states[k] ?? 0), 0) || 1;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-bg-soft" role="img" aria-label={ORDER.map((k) => `${states[k] ?? 0} ${k}`).join(", ")}>
        {ORDER.map((k) => (
          <div key={k} style={{ width: `${((states[k] ?? 0) / total) * 100}%`, background: COLOURS[k] }} className="transition-[width] duration-700" />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOURS[k] }} />
            {MOOD[k]?.label} <span className="text-ink-soft">{states[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
