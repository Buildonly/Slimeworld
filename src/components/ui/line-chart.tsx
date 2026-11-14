/**
 * Small responsive line chart in SVG. Draws a dashed reference line (for
 * example the base price) and adapts to light and dark through CSS colours.
 */
type Props = {
  values: number[];
  reference?: number;
  colour?: string;
  height?: number;
  label: string;
  /** Fixed range; defaults to the data range with some padding. */
  min?: number;
  max?: number;
};

export function LineChart({ values, reference, colour = "var(--accent)", height = 64, label, min, max }: Props) {
  const w = 240;
  const pts = values.length > 1 ? values : values.length === 1 ? [values[0]!, values[0]!] : [];
  if (!pts.length) return <div className="grid place-items-center text-xs text-ink-soft" style={{ height }}>No history yet</div>;
  const all = reference !== undefined ? [...pts, reference] : pts;
  const lo = min ?? Math.min(...all) * 0.95;
  const hi = max ?? Math.max(...all) * 1.05;
  const span = hi - lo || 1;
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => height - 4 - ((v - lo) / span) * (height - 8);
  const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={label}>
      <path d={`${line} L${w},${height} L0,${height} Z`} fill={colour} opacity="0.12" />
      {reference !== undefined && <line x1="0" x2={w} y1={y(reference)} y2={y(reference)} stroke="var(--ink-soft)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(pts.length - 1)} cy={y(pts.at(-1)!)} r="3.5" fill={colour} />
    </svg>
  );
}
