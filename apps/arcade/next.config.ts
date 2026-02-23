import type { NextConfig } from "next";
import path from "path";

// In an npm workspace, packages live in the repo root's node_modules.
// Turbopack's root must point to the workspace root so it can resolve
// the Next.js package and shared dependencies.
// process.cwd() is always the arcade app directory when build scripts run.
const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
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
