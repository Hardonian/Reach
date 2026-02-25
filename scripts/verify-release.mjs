#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = path.join(root, "CHANGELOG.md");
const versionPath = path.join(root, "VERSION");
const releaseWorkflowPath = path.join(root, ".github", "workflows", "release.yml");
const releaseNotesScript = path.join(root, "scripts", "release", "render-release-notes.mjs");

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`✅ ${message}`);
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function main() {
  const changelog = readRequired(changelogPath);
  const version = readRequired(versionPath).trim().replace(/^v/, "");
  const workflow = readRequired(releaseWorkflowPath);

  if (!/^(\d+)\.(\d+)\.(\d+)$/.test(version)) {
    fail(`VERSION must be SemVer (found "${version}")`);
  }
  pass(`VERSION is valid SemVer (${version})`);

  if (!changelog.includes("## [Unreleased]")) {
    fail("CHANGELOG.md must include an [Unreleased] section");
  }
  pass("CHANGELOG includes [Unreleased]");

  if (!workflow.includes("concurrency:")) {
    fail("release workflow must define concurrency control");
  }
  pass("release workflow has concurrency control");

  if (!workflow.includes("SHA256SUMS")) {
    fail("release workflow must generate SHA256SUMS");
  }
  pass("release workflow generates checksums");

  if (!workflow.includes("body_path:")) {
    fail("release workflow should publish notes from changelog-derived body_path");
  }
  pass("release workflow publishes changelog-derived notes");

  if (!workflow.includes("retention-days:")) {
    fail("release workflow should set artifact retention-days");
  }
  pass("release workflow sets artifact retention");

  const installers = [
    path.join(root, "scripts", "release", "install.sh"),
    path.join(root, "scripts", "release", "install.ps1"),
    path.join(root, "reach"),
  ];
  for (const installer of installers) {
    if (!fs.existsSync(installer)) {
      fail(`Missing installer asset: ${installer}`);
    }
  }
  pass("installer assets are present");

  const outPath = path.join(root, "dist", "verify-release-notes.md");
  const render = spawnSync(
    process.execPath,
    [releaseNotesScript, "--version", version, "--output", outPath],
    { stdio: "inherit" },
  );
  if (render.status !== 0) {
    fail("release notes rendering failed");
  }
  if (!fs.existsSync(outPath) || fs.readFileSync(outPath, "utf8").trim().length === 0) {
    fail("release notes output is empty");
  }
  pass("release notes render dry-run succeeded");

  console.log("✅ verify:release passed");
}

main();
