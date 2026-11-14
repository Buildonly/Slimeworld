"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FastForward, Globe2, Home, ScrollText, ShoppingBasket, Store } from "lucide-react";
import type { ClockDto } from "@/lib/dto";
import { explorer, formatBits } from "@/lib/format";
import { usePoll } from "@/lib/use-poll";
import { SlimeMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

type Status = { clock: ClockDto; signedIn: boolean; coins: string | null; town: string; network: string };

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/town", label: "Town", icon: Store },
  { href: "/market", label: "Market", icon: ShoppingBasket },
  { href: "/log", label: "Log", icon: ScrollText },
  { href: "/world", label: "World", icon: Globe2 },
];

const SEASON_EMOJI: Record<string, string> = { calm: "🌤️", heatwave: "🔥", harvest: "🌾", festival: "🎪" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { data } = usePoll<Status>("/api/status", 10_000);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <SlimeMark />
            <span className="text-lg">Slimeworld</span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-bg-soft aria-[current=page]:bg-bg-soft aria-[current=page]:text-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {data && (
              <span className="hidden rounded-full bg-bg-soft px-3 py-1 text-sm sm:inline" title={data.clock.seasonTitle}>
                {SEASON_EMOJI[data.clock.season] ?? "🌤️"} Day {data.clock.day} · {String(data.clock.hour).padStart(2, "0")}:00
              </span>
            )}
            {data?.coins && (
              <span className="rounded-full bg-coin/25 px-3 py-1 text-sm font-semibold" aria-label="Your coins">
                🪙 {formatBits(data.coins)}
              </span>
            )}
            <Link href="/fast" aria-label="Fast forward" className="grid h-10 w-10 place-items-center rounded-full bg-bg-soft">
              <FastForward size={18} />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 md:pb-12">{children}</main>

      <footer className="hidden pb-6 text-center text-sm text-ink-soft md:block">
        {data && (
          <a href={explorer("address", data.town)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:underline">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Built on NEAR · see the town&apos;s money live
          </a>
        )}
      </footer>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 py-2.5 text-xs text-ink-soft aria-[current=page]:text-accent"
              >
                <n.icon size={22} strokeWidth={2.2} />
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
