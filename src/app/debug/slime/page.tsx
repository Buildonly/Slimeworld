import type { Metadata } from "next";
import { SlimeDebug } from "./slime-debug";

export const metadata: Metadata = { title: "Slime debug · Slimeworld" };

export default function Page() {
  return <SlimeDebug />;
}
