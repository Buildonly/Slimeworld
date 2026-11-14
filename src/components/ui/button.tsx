import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "accent" | "soft" | "coin" | "danger"; size?: "md" | "lg" };

const TONES = {
  accent: "bg-accent text-accent-ink shadow-[0_4px_0_color-mix(in_srgb,var(--accent)_60%,black)]",
  coin: "bg-coin text-[#3a2a07] shadow-[0_4px_0_color-mix(in_srgb,var(--coin)_60%,black)]",
  soft: "bg-bg-soft text-ink shadow-[0_4px_0_var(--line)]",
  danger: "bg-danger text-white shadow-[0_4px_0_color-mix(in_srgb,var(--danger)_60%,black)]",
};

/** Chunky game button that presses down. */
export function Button({ tone = "accent", size = "md", className = "", ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 ${
        size === "lg" ? "px-6 py-4 text-lg" : "px-4 py-2.5"
      } ${TONES[tone]} ${className}`}
    />
  );
}
