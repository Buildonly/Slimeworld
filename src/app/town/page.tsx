import type { Metadata } from "next";
import { TownScreen } from "@/components/town/town-screen";
import { currentPlayerId } from "@/server/session";

export const metadata: Metadata = { title: "Town · Slimeworld" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return <TownScreen signedIn={Boolean(await currentPlayerId())} />;
}
