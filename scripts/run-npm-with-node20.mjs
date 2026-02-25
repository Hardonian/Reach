#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const minNodeMajor = 20;
const minNodeMinor = 9;

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

if (!npmCliPath) {
  console.error("Unable to locate npm-cli.js. Run npm install to provision npm dependencies.");
  process.exit(1);
}

const npmArgs = process.argv.slice(2);
if (npmArgs.length === 0) {
  console.error("Usage: node scripts/run-npm-with-node20.mjs <npm-args...>");
  process.exit(1);
}

let nodeBin = process.execPath;
if (!isSupportedNode() && existsSync(bundledNodePath)) {
  nodeBin = bundledNodePath;
  console.warn(
    `Node ${process.versions.node} is unsupported. Re-running npm with bundled ${path.basename(bundledNodePath)}.`,
  );
}

if (!isSupportedNode() && nodeBin === process.execPath) {
  console.error(
    `Node ${process.versions.node} is unsupported and bundled Node 20 was not found at ${bundledNodePath}.`,
  );
  process.exit(1);
}

const run = spawnSync(nodeBin, [npmCliPath, ...npmArgs], {
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

process.exit(run.status ?? 1);
