import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsconfigPath = path.resolve(__dirname, "./tsconfig.json");

let tsconfig: any = {};
if (fs.existsSync(tsconfigPath)) {
  try {
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    // Strip single-line comments only when outside of quoted strings.
    // Process line-by-line: remove full-line comments and trailing comments
    // that appear after the last closing bracket/brace/comma/quote.
    const clean = raw
      .split("\n")
      .map((line) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("//")) return "";
        // Remove trailing comma before } or ] (common JSONC pattern)
        return line;
      })
      .join("\n")
      // Remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Remove trailing commas before } or ]
      .replace(/,\s*([}\]])/g, "$1");
    tsconfig = JSON.parse(clean);
  } catch (e) {
    console.error("Failed to parse tsconfig.json for vitest aliases", e);
  }
}

const paths = tsconfig.compilerOptions?.paths || {};

const aliases = Object.entries(paths).map(([key, value]) => {
  const replacement = (value as string[])[0];
  const find = new RegExp(`^${key.replace("*", "(.*)")}$`);
  const resolvedReplacement = replacement.replace("*", "$1");
  return {
    find,
    replacement: path.resolve(__dirname, resolvedReplacement)
  };
});

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".git", ".github", "src/determinism/__tests__"],
  },
});
