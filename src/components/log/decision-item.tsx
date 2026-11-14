import type { DecisionDto } from "@/lib/dto";
import { formatBits, ITEM_EMOJI } from "@/lib/format";
import { VerifiedBadge } from "./verified-badge";

const ACTION_EMOJI: Record<string, string> = { buy: "🛒", job: "💼", save: "🐷", sell: "🪙", race: "🏁", puzzle: "🧩", train: "📚", toy: "🎾", hat: "🎉", gift: "🎁" };

export function hourLabel(tick: number) {
  return `Day ${Math.floor(tick / 24) + 1}, ${String(tick % 24).padStart(2, "0")}:00`;
}

/** One slime decision: what, why (in its own voice), cost, and how it was decided. */
export function DecisionItem({ d }: { d: DecisionDto }) {
  const cost = BigInt(d.cost);
  const icon = (d.target && ITEM_EMOJI[d.target]) || ACTION_EMOJI[d.action] || "💭";
  return (
    <li className="flex gap-3 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-bg-soft text-xl" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold capitalize">{d.action}</span>
          <VerifiedBadge verified={d.verified} source={d.source} proof={d.proof} />
          <span className="ml-auto text-xs text-ink-soft">{hourLabel(d.tick)}</span>
        </div>
        <p className="text-ink-soft">“{d.reason}”</p>
        {d.say && <p className="text-sm">💬 {d.say}</p>}
      </div>
      <span className={`shrink-0 self-center text-sm font-semibold ${cost < 0n ? "text-accent" : cost > 0n ? "" : "text-ink-soft"}`}>
        {cost < 0n ? `+${formatBits(-cost)}` : cost > 0n ? `-${formatBits(cost)}` : "free"}
      </span>
    </li>
  );
}
