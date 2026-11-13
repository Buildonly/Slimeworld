import { db } from "@/db/client";
import { serverEnv } from "@/lib/env";
import { getPlayer } from "@/server/players";
import { currentPlayerId } from "@/server/session";
import { SignIn } from "@/components/sign-in";
import { SignOut } from "@/components/sign-out";

export const dynamic = "force-dynamic";

export default async function Home() {
  const env = serverEnv();
  const id = await currentPlayerId();
  const player = id ? await getPlayer(db(), id) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-semibold">Slimeworld</h1>
      {player ? (
        <div className="flex w-full flex-col items-center gap-3 rounded-3xl border border-line bg-card p-6">
          <p className="text-ink-soft">Signed in as {player.email ?? "a new player"}</p>
          <p className="text-sm text-ink-soft">Your town account</p>
          <p data-testid="near-account" className="break-all font-mono text-sm">
            {player.nearAccountId ?? "Being made…"}
          </p>
          <SignOut />
        </div>
      ) : (
        <>
          <p className="text-ink-soft">Raise a slime that earns its own living.</p>
          <SignIn devLogin={env.DEV_LOGIN === "1" && env.NODE_ENV !== "production"} />
        </>
      )}
    </main>
  );
}
