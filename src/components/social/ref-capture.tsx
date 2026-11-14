"use client";

import { useEffect } from "react";

/** Remember an invite code from ?ref=… until the visitor signs in (7 days). */
export function RefCapture() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[0-9a-z]{6,16}$/.test(ref)) document.cookie = `slime_ref=${ref}; max-age=${7 * 24 * 60 * 60}; path=/; samesite=lax`;
  }, []);
  return null;
}
