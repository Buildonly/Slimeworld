import type { Metadata } from "next";
import { Suspense } from "react";
import { LogScreen } from "@/components/log/log-screen";
import { Loading } from "@/components/ui/states";

export const metadata: Metadata = { title: "Slime log · Slimeworld" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <LogScreen />
    </Suspense>
  );
}
