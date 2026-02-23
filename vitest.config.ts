import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@zeo/core": path.resolve(__dirname, "./packages/core/src/index.ts"),
      "@zeo/contracts": path.resolve(__dirname, "./packages/contracts/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/integration/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".git", ".github"],
  },
});
