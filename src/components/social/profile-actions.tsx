"use client";

import { useRouter } from "next/navigation";
import { SlimeActions } from "./slime-actions";

/** Social buttons on a profile page; refreshes the page after a cheer or gift. */
export function ProfileActions(props: { slimeId: string; name: string; canGift: boolean; canCheer: boolean; signedIn: boolean; giftMax: number }) {
  const router = useRouter();
  return <SlimeActions {...props} onDone={() => router.refresh()} />;
}
