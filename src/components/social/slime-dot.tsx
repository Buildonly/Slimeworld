import { COLOUR_STYLES, type SlimeColour } from "@/components/slime/look";

/** A little slime blob in the slime's own colour, for lists. */
export function SlimeDot({ colour, size = 28 }: { colour: string | null; size?: number }) {
  const style = colour && colour in COLOUR_STYLES ? COLOUR_STYLES[colour as SlimeColour] : null;
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size * 0.8 }}>
      <span className="absolute inset-0 rounded-t-full rounded-b-[40%]" style={{ background: style?.hex ?? "var(--line)", opacity: style?.opacity ?? 1 }} />
      <span className="absolute left-[30%] top-[38%] h-[14%] w-[10%] rounded-full bg-black/70" />
      <span className="absolute right-[30%] top-[38%] h-[14%] w-[10%] rounded-full bg-black/70" />
    </span>
  );
}
