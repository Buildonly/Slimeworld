import type { SlimeDto } from "@/lib/dto";
import { MOOD } from "@/lib/format";
import { COLOUR_STYLES } from "@/components/slime/look";

/** Top-left: who you are playing and how it feels. */
export function SlimeBadge({ slime, onOpen }: { slime: SlimeDto; onOpen: () => void }) {
  const mood = slime.lonely && slime.state !== "asleep" ? MOOD.lonely! : MOOD[slime.state] ?? MOOD.fine!;
  return (
    <button type="button" onClick={onOpen} className="pointer-events-auto flex items-center gap-3 rounded-full bg-card/85 py-1.5 pl-1.5 pr-4 shadow-lg backdrop-blur" aria-label={`${slime.name}: ${mood.label}. Open journal`}>
      <span className="relative grid h-11 w-11 place-items-center rounded-full text-xl" style={{ background: COLOUR_STYLES[slime.colour].hex }}>
        <span aria-hidden="true">{mood.emoji}</span>
      </span>
      <span className="flex flex-col items-start">
        <span className="font-semibold leading-tight">{slime.name}</span>
        <span className="flex items-center gap-1.5">
          <Bar value={slime.energy} colour="var(--coin)" label="Energy" />
          <Bar value={slime.joy} colour="#ff8fc7" label="Happiness" />
        </span>
      </span>
    </button>
  );
}

function Bar({ value, colour, label }: { value: number; colour: string; label: string }) {
  return (
    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-black/10" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(4, value)}%`, background: colour }} />
    </span>
  );
}
