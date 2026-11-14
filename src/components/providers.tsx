"use client";

/**
 * App-wide providers. Sign in (Privy) is not here on purpose: it loads only
 * inside the sign-in sheet, so the first page stays light.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
