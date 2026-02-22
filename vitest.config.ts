import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsconfigBasePath = path.resolve(__dirname, "../../tsconfig.base.json");
const tsconfigBase = JSON.parse(fs.readFileSync(tsconfigBasePath, "utf-8")) as {
  compilerOptions?: { paths?: Record<string, string[]> };
};

const aliases = [
  // Force @zeo/* to resolve to src/index.ts for tests
  {
    find: /^@zeo\/(.*)$/,
    replacement: path.resolve(__dirname, "../../packages/$1/src/index.ts")
  },
  // Map other paths from tsconfig (e.g. @prisma/client)
  ...Object.entries(tsconfigBase.compilerOptions?.paths ?? {})
    .filter(([key]) => !key.startsWith("@zeo"))
    .map(([key, value]) => {
      const paths = Array.isArray(value) ? value : [value];
      const replacement = paths[0];
      const find = new RegExp(`^${key.replace("*", "(.*)")}$`);
      const resolved = replacement.replace("*", "$1");
      const withEntry = path.extname(resolved) === "" ? `${resolved}/index.ts` : resolved;
      const target = path.resolve(__dirname, "../../", withEntry);
      return { find, replacement: target };
    })
];

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
