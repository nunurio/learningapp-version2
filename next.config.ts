import type { NextConfig } from "next";

// Extend typing to include Turbopack root option until types catch up
type NextConfigWithTurbopack = NextConfig & { turbopack?: { root?: string }; allowedDevOrigins?: string[] };

const nextConfig: NextConfigWithTurbopack = {
  turbopack: {
    // Pin build root to this project to avoid multi-lockfile inference
    root: __dirname,
  },
  // Playwright(E2E)実行時に 127.0.0.1 からの /_next/* 参照が発生するため許可
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
};

export default nextConfig;
