import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const round = Fredoka({ subsets: ["latin"], variable: "--font-round" });

export const metadata: Metadata = {
  title: "Slimeworld",
  description: "Raise a slime that earns its own living.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1524" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={round.variable} suppressHydrationWarning>
      <head>
        {/* Apply a saved theme before the first paint (no flash). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
