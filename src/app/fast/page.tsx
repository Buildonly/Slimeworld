import type { Metadata } from "next";
import { FastForward } from "@/components/fast/fast-forward";

export const metadata: Metadata = { title: "Fast forward · Slimeworld" };

export default function Page() {
  return <FastForward />;
}
