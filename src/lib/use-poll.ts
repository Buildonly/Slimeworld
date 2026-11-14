"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Poll<T> = { data: T | null; error: string | null; loading: boolean; refresh: () => Promise<void> };

/** Fetch JSON now and every `ms` while the tab is visible. */
export function usePoll<T>(url: string | null, ms = 5000): Poll<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as T & { error?: string };
      if (!alive.current) return;
      if (!res.ok) setError(json.error ?? "Something went wrong.");
      else {
        setData(json);
        setError(null);
      }
    } catch {
      if (alive.current) setError("Can't reach the town right now.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    const first = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, ms);
    return () => {
      alive.current = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh, ms]);

  return { data, error, loading, refresh };
}

/** POST JSON and return { ok, message|error }. */
export async function post<T = { ok: boolean; message?: string; error?: string }>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json().catch(() => ({ ok: false, error: "Something went wrong." }))) as T;
}
