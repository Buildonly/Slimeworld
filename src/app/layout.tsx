import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
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
    <html lang="en" className={round.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
