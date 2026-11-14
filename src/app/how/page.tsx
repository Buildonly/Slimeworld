import type { Metadata } from "next";
import Link from "next/link";
import { BuiltOnNear } from "@/components/brand/near-logo";
import { STARTER_COINS } from "@/economy/config";
import { formatBits } from "@/lib/format";

export const metadata: Metadata = { title: "How it works · Slimeworld" };

const STEPS = [
  { icon: "🥚", title: "Hatch", text: `Name your slime. You both get coins to start: ${formatBits(STARTER_COINS.slime)} for it, ${formatBits(STARTER_COINS.purse)} for you.` },
  { icon: "🕹️", title: "Move", text: "Use the stick or arrow keys. Drag to look around. The map turns with you." },
  { icon: "🧠", title: "It lives on its own", text: "Your slime eats, works, shops and saves by itself, even when you're away." },
  { icon: "📏", title: "You set the rules", text: "Pick its daily spend limit, what it may buy, and what to save. It can't break them." },
  { icon: "💬", title: "Talk and care", text: "Chat with it, pat it, feed it. Happy slimes work and race better." },
  { icon: "🏁", title: "Earn", text: "Jobs and races pay coins. Caring for slimes earns $GOO." },
  { icon: "🤝", title: "Play together", text: "Invite friends, join a clan, trade on the market, climb the ranks." },
];

const PLACES = [
  { icon: "⛲", name: "Town Square", text: "Where you start." },
  { icon: "🏁", name: "Race ground", text: "North. Race for prizes." },
  { icon: "💼", name: "Job board", text: "East. Work for coins." },
  { icon: "🛒", name: "Market Street", text: "South. Food, toys, lessons." },
];

const FAQ = [
  { q: "Do I need crypto?", a: "No. Play as a guest or with email. The game makes your wallet." },
  { q: "Is it real money?", a: "Coins are play money with no cash value." },
  { q: "Who owns my slime?", a: "You. It's an NFT with its own NEAR wallet. You can move it to your own wallet any time." },
  { q: "Can the game cheat?", a: "No. A contract on NEAR checks every payment against your rules." },
];

/** One short page: what the game is, where things are, and the usual questions. */
export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <BuiltOnNear className="text-sm font-semibold text-ink-soft" />
        <h1 className="text-3xl font-bold">How Slimeworld works</h1>
        <p className="text-ink-soft">Raise a slime that earns, spends and saves on its own.</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-2xl border border-line bg-card p-4">
            <span className="text-3xl" aria-hidden>
              {s.icon}
            </span>
            <div>
              <p className="font-semibold">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-ink-soft">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Finding your way</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PLACES.map((p) => (
            <div key={p.name} className="rounded-2xl bg-bg-soft p-3 text-center">
              <p className="text-2xl" aria-hidden>
                {p.icon}
              </p>
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-ink-soft">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Questions</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="rounded-2xl bg-bg-soft p-3">
            <summary className="cursor-pointer font-semibold">{f.q}</summary>
            <p className="pt-1 text-sm text-ink-soft">{f.a}</p>
          </details>
        ))}
      </section>

      <Link href="/" className="self-center rounded-2xl bg-accent px-6 py-3 text-lg font-semibold text-accent-ink">
        Play now
      </Link>
    </main>
  );
}
