import type { Metadata } from "next";
import { WorldScreen } from "@/components/world/world-screen";

export const metadata: Metadata = { title: "World · Slimeworld" };

export default function Page() {
  return <WorldScreen />;
}
