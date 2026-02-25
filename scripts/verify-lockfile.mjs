#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const lockfile = "package-lock.json";

if (!fs.existsSync(lockfile)) {
  console.error(`❌ Missing ${lockfile}`);
  process.exit(1);
}

try {
  const parsed = JSON.parse(fs.readFileSync(lockfile, "utf8"));
  if (!parsed.lockfileVersion) {
    console.error("❌ package-lock.json is missing lockfileVersion");
    process.exit(1);
  }
} catch (err) {
  console.error(`❌ Failed to parse package-lock.json: ${String(err)}`);
  process.exit(1);
}

const ciDryRun = spawnSync("npm", ["ci", "--ignore-scripts", "--dry-run"], { stdio: "inherit" });
if (ciDryRun.status !== 0) {
  console.error("❌ npm ci --dry-run failed; lockfile is not installable");
  process.exit(ciDryRun.status ?? 1);
}

console.log("✅ lockfile verification passed");
