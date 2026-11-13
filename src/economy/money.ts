import { BITS_PER_COIN, type Bits } from "./config";

/** Show bits as coins with at most one decimal: 810 -> "8.1", 800 -> "8". */
export function formatCoins(bits: Bits): string {
  const sign = bits < 0n ? "-" : "";
  const abs = bits < 0n ? -bits : bits;
  const whole = abs / BITS_PER_COIN;
  const tenth = ((abs % BITS_PER_COIN) * 10n) / BITS_PER_COIN;
  return `${sign}${whole}${tenth > 0n ? `.${tenth}` : ""}`;
}

export const minBits = (a: Bits, b: Bits): Bits => (a < b ? a : b);
export const maxBits = (a: Bits, b: Bits): Bits => (a > b ? a : b);
