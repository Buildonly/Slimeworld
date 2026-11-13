import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is written by hand for this repo; do not let `next dev` edit it.
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
};

export default nextConfig;
