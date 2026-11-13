/** Client-side money formatting from exact bit strings (100 bits = 1 coin). */
export function formatBits(bits: string | bigint | null | undefined): string {
  if (bits === null || bits === undefined) return "–";
  const b = typeof bits === "bigint" ? bits : BigInt(bits);
  const neg = b < 0n;
  const abs = neg ? -b : b;
  const whole = abs / 100n;
  const tenth = ((abs % 100n) * 10n) / 100n;
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${tenth > 0n ? `.${tenth}` : ""}`;
}

export const ITEM_EMOJI: Record<string, string> = {
  berries: "🫐",
  jelly: "🍮",
  cake: "🍰",
  ice: "🧊",
  ball: "🏐",
  book: "📘",
  weights: "🏋️",
  hat: "🎉",
  iron: "🔩",
  wood: "🪵",
};

export const MOOD: Record<string, { label: string; emoji: string; tone: string }> = {
  thriving: { label: "Thriving", emoji: "✨", tone: "bg-accent/20 text-accent" },
  fine: { label: "Fine", emoji: "🙂", tone: "bg-sky/60 text-ink" },
  hungry: { label: "Hungry", emoji: "🍽️", tone: "bg-coin/25 text-ink" },
  broke: { label: "Broke", emoji: "💧", tone: "bg-danger/15 text-danger" },
  asleep: { label: "Asleep", emoji: "💤", tone: "bg-line text-ink-soft" },
  lonely: { label: "Lonely", emoji: "🥺", tone: "bg-[#c9b8ff]/40 text-ink" },
};

export function explorer(network: string, kind: "address" | "txns", id: string): string {
  const host = network === "mainnet" ? "nearblocks.io" : "testnet.nearblocks.io";
  return `https://${host}/${kind}/${id}`;
}
