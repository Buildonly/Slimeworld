"use client";

import dynamic from "next/dynamic";

/** The 3D slime, loaded only in the browser, with a friendly placeholder while it loads. */
export const SlimeView = dynamic(() => import("./slime-stage"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-24 w-32 animate-pulse rounded-[50%_50%_40%_40%] bg-accent/40" aria-label="Loading your slime" />
    </div>
  ),
});
