import type { Metadata } from "next";
import { Suspense } from "react";
import { RulesScreen } from "@/components/rules/rules-screen";
import { Loading } from "@/components/ui/states";

export const metadata: Metadata = { title: "Rules · Slimeworld" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <RulesScreen />
    </Suspense>
  );
}
