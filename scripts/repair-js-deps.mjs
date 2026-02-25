#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const minNodeMajor = 20;
const minNodeMinor = 9;
const ifNeeded = process.argv.includes("--if-needed");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const bundledNodePath = path.join(
  repoRoot,
  ".artifacts",
  "tools",
  "node-v20.20.0-linux-x64",
  "bin",
  "node",
);

const npmCliCandidates = [
  process.env.npm_execpath,
  path.join(repoRoot, "node_modules", "npm", "bin", "npm-cli.js"),
  path.join(
    repoRoot,
    ".artifacts",
    "tools",
    "node-v20.20.0-linux-x64",
    "lib",
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  ),
  "/usr/share/nodejs/npm/bin/npm-cli.js",
].filter(Boolean);

const npmCliPath = npmCliCandidates.find((candidate) => existsSync(candidate));

function parseNodeVersion(version) {
  const [majorRaw = "0", minorRaw = "0"] = version.split(".");
  return {
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
  };
}

function isSupportedNode(version = process.versions.node) {
  const { major, minor } = parseNodeVersion(version);
  return major > minNodeMajor || (major === minNodeMajor && minor >= minNodeMinor);
}

function isWsl() {
  if (process.platform !== "linux") return false;
  if (process.env.WSL_DISTRO_NAME) return true;
  try {
    return readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function toWindowsPath(posixPath) {
  const converted = spawnSync("wslpath", ["-w", posixPath], { encoding: "utf8" });
  if (converted.status !== 0) return null;
  const winPath = (converted.stdout ?? "").trim();
  return winPath.length > 0 ? winPath : null;
}

function removeDirSafe(target) {
  if (!existsSync(target)) return;

  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    // try Windows fallback for locked files on drvfs
  }

  if (!existsSync(target)) return;
  if (!isWsl()) return;

  const winPath = toWindowsPath(target);
  if (!winPath) return;
  spawnSync("cmd.exe", ["/c", "rmdir", "/s", "/q", winPath], { stdio: "ignore" });
}

function hasHealthyInstall() {
  const required = [
    path.join(repoRoot, "node_modules", ".bin", "next"),
    path.join(repoRoot, "node_modules", "next", "package.json"),
    path.join(repoRoot, "node_modules", "styled-jsx", "package.json"),
    path.join(repoRoot, "node_modules", "rollup", "dist", "native.js"),
    path.join(repoRoot, "node_modules", ".bin", "eslint"),
    path.join(repoRoot, "node_modules", ".bin", "vitest"),
  ];
  return required.every((target) => existsSync(target));
}

function resolveNodeBinary() {
  if (isSupportedNode()) return process.execPath;
  if (existsSync(bundledNodePath)) return bundledNodePath;
  return null;
}

if (ifNeeded && hasHealthyInstall()) {
  console.log("JS dependencies are healthy.");
  process.exit(0);
}

const nodeBin = resolveNodeBinary();
if (!nodeBin) {
  console.error(
    `Node ${process.versions.node} is unsupported and bundled Node 20 is not available at ${bundledNodePath}.`,
  );
  process.exit(1);
}

if (!npmCliPath) {
  console.error("Unable to locate npm-cli.js. Cannot repair dependencies.");
  process.exit(1);
}

if (!ifNeeded) {
  console.log("Repairing JavaScript dependencies...");
}

removeDirSafe(path.join(repoRoot, "node_modules"));
removeDirSafe(path.join(repoRoot, "apps", "arcade", "node_modules"));
removeDirSafe(path.join(repoRoot, "apps", "docs", "node_modules"));

const install = spawnSync(nodeBin, [npmCliPath, "install", "--no-audit", "--no-fund"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PATH:
      nodeBin === process.execPath
        ? process.env.PATH
        : `${path.dirname(nodeBin)}${path.delimiter}${process.env.PATH ?? ""}`,
    npm_config_scripts_prepend_node_path: "true",
  },
});

if (install.status !== 0) {
  console.error("Dependency reinstall failed.");
  process.exit(install.status ?? 1);
}

if (!hasHealthyInstall()) {
  console.error("Dependencies reinstalled, but required modules are still missing.");
  process.exit(1);
}

console.log("Dependency repair complete.");
