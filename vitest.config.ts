import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Static aliases matching tsconfig.json paths
const aliases = [
  {
    find: /^@zeo\/core$/,
    replacement: path.resolve(__dirname, "./src/core/shim.ts"),
  },
  {
    find: /^@zeo\/contracts$/,
    replacement: path.resolve(__dirname, "./sdk/ts/src/index.ts"),
  },
  {
    find: /^@reach\/governance$/,
    replacement: path.resolve(__dirname, "./packages/governance/src/index.ts"),
  },
  { find: /^@zeo\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
];

export default defineConfig({
  resolve: {
    alias: aliases,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "packages/**/*.test.ts"],
    // Exclude: node_modules/build artifacts, and src/determinism/__tests__ (uses Node.js native test runner)
    exclude: ["node_modules", "dist", ".git", ".github", "src/determinism/__tests__"],
  },
});
