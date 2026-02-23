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
  { find: /^@zeo\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
];

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [
      "node_modules",
      "dist",
      ".git",
      ".github",
      "src/determinism/__tests__",
    ],
  },
});
