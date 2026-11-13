import { useId } from "react";
import { formatBits } from "@/lib/format";

/** The slime's wallet as a jar of coins; fuller is richer (relative to 400 coins). */
export function CoinJar({ bits }: { bits: string }) {
  const coins = Number(BigInt(bits) / 100n);
  const fill = Math.min(1, coins / 400);
  const clip = useId();
  return (
    <div className="flex items-center gap-3">
      <svg width="44" height="54" viewBox="0 0 44 54" aria-hidden="true">
        <rect x="8" y="2" width="28" height="7" rx="3" fill="var(--line)" />
        <path d="M6 12h32c2 0 4 2 4 5v28c0 4-3 7-7 7H9c-4 0-7-3-7-7V17c0-3 2-5 4-5z" fill="var(--bg-soft)" stroke="var(--line)" strokeWidth="2" />
        <clipPath id={clip}>
          <path d="M6 12h32c2 0 4 2 4 5v28c0 4-3 7-7 7H9c-4 0-7-3-7-7V17c0-3 2-5 4-5z" />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          <rect x="0" y={52 - 40 * fill} width="44" height={40 * fill + 2} fill="var(--coin)" />
          {fill > 0.1 && <circle cx="14" cy={50 - 40 * fill + 6} r="4" fill="#fff3c4" opacity=".7" />}
        </g>
      </svg>
      <div>
        <p className="text-sm text-ink-soft">Wallet</p>
        <p className="text-2xl font-semibold">🪙 {formatBits(bits)}</p>
      </div>
    </div>
  );
}
