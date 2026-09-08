#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const supported = /\.(?:[cm]?[jt]sx?|json|jsonc|ya?ml|md|mdx|css|scss|html)$/i;
const excluded =
  /^(?:\.cache|\.reach|node_modules|dist|build|target|logs|stitch_exports)\//;

function gitNames(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split("\0").filter(Boolean);
}

const names = new Set([
  ...gitNames(["diff", "--name-only", "-z", "origin/main...HEAD"]),
  ...gitNames(["diff", "--name-only", "-z"]),
  ...gitNames(["diff", "--cached", "--name-only", "-z"]),
  ...gitNames(["ls-files", "--others", "--exclude-standard", "-z"]),
]);

const files = [...names]
  .filter(
    (file) => supported.test(file) && !excluded.test(file) && existsSync(file),
  )
  .sort();

if (files.length === 0) {
  console.log("format:check passed (no changed Prettier-managed files).");
  process.exit(0);
}

const result = spawnSync("npx", ["prettier", "--check", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
