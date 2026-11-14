import { serverEnv } from "@/lib/env";

/** NEAR Intents 1Click API base URL, from ONECLICK_URL. */
export function oneClickUrl(): string {
  const url = serverEnv().ONECLICK_URL;
  if (!url) throw new Error("ONECLICK_URL is not set");
  return url.replace(/\/$/, "");
}
