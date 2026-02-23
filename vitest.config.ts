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
    const clean = raw.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
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
    include: ["src/**/*.test.ts", "test/integration/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".git", ".github"],
  },
});
