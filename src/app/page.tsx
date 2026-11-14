import { serverEnv } from "@/lib/env";
import { currentPlayerId } from "@/server/session";
import { HomeScreen } from "@/components/home/home-screen";
import { Landing } from "@/components/home/landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const env = serverEnv();
  const signedIn = Boolean(await currentPlayerId());
  return signedIn ? <HomeScreen /> : <Landing devLogin={env.DEV_LOGIN === "1" && env.NODE_ENV !== "production"} />;
}
