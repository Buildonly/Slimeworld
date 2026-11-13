"use client";

import { PrivyProvider } from "@privy-io/react-auth";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/** App-wide providers. Privy only loads when an app id is configured. */
export function Providers({ children }: { children: React.ReactNode }) {
  if (!privyAppId) return <>{children}</>;
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google"],
        appearance: { landingHeader: "Sign in to Slimeworld", showWalletLoginFirst: false },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

export const privyEnabled = Boolean(privyAppId);
