import type { Metadata } from "next";
import { MarketScreen } from "@/components/market/market-screen";
import { currentPlayerId } from "@/server/session";

export const metadata: Metadata = { title: "Market · Slimeworld" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return <MarketScreen signedIn={Boolean(await currentPlayerId())} />;
}
