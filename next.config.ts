import type { NextConfig } from "next";

// Extend typing to include Turbopack root option until types catch up
type NextConfigWithTurbopack = NextConfig & { turbopack?: { root?: string } };

const nextConfig: NextConfigWithTurbopack = {
  turbopack: {
    // Pin build root to this project to avoid multi-lockfile inference
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default nextConfig;
