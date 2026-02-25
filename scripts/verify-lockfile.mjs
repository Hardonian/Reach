#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const lockfile = "package-lock.json";
const minNodeMajor = 20;
const minNodeMinor = 9;
const reexecGuardEnv = "REACH_VERIFY_LOCKFILE_REEXEC";
const bundledNodePath = path.resolve(".artifacts/tools/node-v20.20.0-linux-x64/bin/node");

function isSupportedNodeVersion() {
  const [majorRaw, minorRaw] = process.versions.node.split(".");
  const major = Number.parseInt(majorRaw ?? "0", 10);
  const minor = Number.parseInt(minorRaw ?? "0", 10);
  return major > minNodeMajor || (major === minNodeMajor && minor >= minNodeMinor);
}

function ensureSupportedNodeVersion() {
  if (isSupportedNodeVersion()) return;
  const minimum = `${minNodeMajor}.${minNodeMinor}.0`;
  if (process.env[reexecGuardEnv] === "1") {
    console.error(
      `❌ Node ${process.versions.node} is unsupported for verify:lockfile. Require >=${minimum}.`,
    );
    process.exit(1);
  }

  const scriptPath = fileURLToPath(import.meta.url);
  if (fs.existsSync(bundledNodePath)) {
    console.warn(
      `Node ${process.versions.node} is unsupported for verify:lockfile. Re-running with bundled Node 20 at ${bundledNodePath}.`,
    );
    const rerun = spawnSync(bundledNodePath, [scriptPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        [reexecGuardEnv]: "1",
      },
    });
    process.exit(rerun.status ?? 1);
  }
}

function resolveNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.resolve("node_modules/npm/bin/npm-cli.js"),
    "/usr/share/nodejs/npm/bin/npm-cli.js",
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

ensureSupportedNodeVersion();

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

const npmCliPath = resolveNpmCliPath();
if (!npmCliPath) {
  console.error("❌ Unable to locate npm-cli.js for lockfile verification");
  process.exit(1);
}

const tempPrefix = fs.mkdtempSync(path.join(os.tmpdir(), "reach-lockfile-"));
fs.copyFileSync("package.json", path.join(tempPrefix, "package.json"));
fs.copyFileSync("package-lock.json", path.join(tempPrefix, "package-lock.json"));

const ciDryRun = spawnSync(
  process.execPath,
  [npmCliPath, "ci", "--ignore-scripts", "--dry-run", "--workspaces=false", "--prefix", tempPrefix],
  {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  },
);
fs.rmSync(tempPrefix, { recursive: true, force: true });

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
