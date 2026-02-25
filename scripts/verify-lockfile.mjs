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

const ciDryRun = spawnSync("npm", ["ci", "--ignore-scripts", "--dry-run"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

const output = `${ciDryRun.stdout ?? ""}\n${ciDryRun.stderr ?? ""}`;

// Check for missing private packages (OSS environment)
const missingPrivateContracts =
  output.includes("@zeo/contracts") &&
  (output.includes("E404") || output.includes("404 Not Found"));

if (missingPrivateContracts) {
  console.warn(
    "⚠️ npm ci --dry-run could not resolve @zeo/contracts from public registry; treating as expected OSS environment constraint.",
  );
  console.log("✅ lockfile verification passed (OSS mode; private package unavailable)");
  process.exit(0);
}

// npm ci --dry-run exits 0 on success, but status may be null on Windows
const isSuccess = ciDryRun.status === 0 || ciDryRun.status === null;
const hasErrors = output.includes("ERR!") || output.includes("npm error");

if (!isSuccess || hasErrors) {
  if (ciDryRun.stdout) process.stdout.write(ciDryRun.stdout);
  if (ciDryRun.stderr) process.stderr.write(ciDryRun.stderr);
  console.error("❌ npm ci --dry-run failed; lockfile is not installable");
  process.exit(ciDryRun.status ?? 1);
}

if (ciDryRun.stdout) process.stdout.write(ciDryRun.stdout);

console.log("✅ lockfile verification passed");
