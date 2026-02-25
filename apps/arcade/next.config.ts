import type { NextConfig } from "next";
import path from "path";

// In an npm workspace, packages live in the repo root's node_modules.
// Turbopack's root must point to the workspace root so it can resolve
// the Next.js package and shared dependencies.
// process.cwd() is always the arcade app directory when build scripts run.
//
// NOTE: Turbopack is disabled by default due to compatibility issues with
// native modules (better-sqlite3) on Windows. To enable Turbopack for faster
// dev builds on macOS/Linux, set ENABLE_TURBOPACK=1.
const useTurbopack = process.env.ENABLE_TURBOPACK === "1";

const nextConfig: NextConfig = {
  ...(useTurbopack && {
    turbopack: {
      root: path.resolve(process.cwd(), "../.."),
    },
  }),
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  experimental: {
    optimizePackageImports: ["@heroicons/react", "lucide-react", "framer-motion"],
  },
};

export default nextConfig;
