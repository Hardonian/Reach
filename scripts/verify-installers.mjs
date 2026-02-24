#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const RELEASE_DIR = path.join(ROOT, "dist", "release-smoke");

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runAllowingDoctorFailure(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0 && result.status !== 1) {
    process.exit(result.status ?? 1);
  }
}

function ensureDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function platformBinaryName() {
  const mapArch = { x64: "amd64", arm64: "arm64" };
  const mapOs = { linux: "linux", darwin: "darwin", win32: "windows" };
  const arch = mapArch[process.arch];
  const osName = mapOs[process.platform];
  if (!arch || !osName) {
    throw new Error(
      `Unsupported platform for installer smoke: ${process.platform}/${process.arch}`,
    );
  }
  const ext = osName === "windows" ? ".exe" : "";
  return `reachctl-${osName}-${arch}${ext}`;
}

function writeChecksums(files) {
  const hasSha256sum = spawnSync("sha256sum", ["--version"], { stdio: "ignore" }).status === 0;
  const hasShasum =
    !hasSha256sum && spawnSync("shasum", ["--version"], { stdio: "ignore" }).status === 0;
  if (!hasSha256sum && !hasShasum) {
    throw new Error("No checksum tool available (sha256sum/shasum).");
  }

  const lines = [];
  for (const file of files) {
    const result = hasSha256sum
      ? spawnSync("sha256sum", [file], { cwd: RELEASE_DIR, encoding: "utf8" })
      : spawnSync("shasum", ["-a", "256", file], { cwd: RELEASE_DIR, encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(`checksum generation failed for ${file}`);
    }
    lines.push(result.stdout.trim());
  }
  fs.writeFileSync(path.join(RELEASE_DIR, "SHA256SUMS"), lines.join("\n") + "\n", "utf8");
}

function main() {
  console.log("Preparing local release assets for installer verification...");
  ensureDir(RELEASE_DIR);

  const binary = platformBinaryName();
  const binaryPath = path.join(RELEASE_DIR, binary);

  run("go", ["build", "-o", binaryPath, "./services/runner/cmd/reachctl"], { cwd: ROOT });
  fs.copyFileSync(path.join(ROOT, "reach"), path.join(RELEASE_DIR, "reach"));
  fs.copyFileSync(
    path.join(ROOT, "scripts/release/install.sh"),
    path.join(RELEASE_DIR, "install.sh"),
  );
  fs.copyFileSync(
    path.join(ROOT, "scripts/release/install.ps1"),
    path.join(RELEASE_DIR, "install.ps1"),
  );
  fs.copyFileSync(path.join(ROOT, "VERSION"), path.join(RELEASE_DIR, "VERSION"));
  fs.chmodSync(path.join(RELEASE_DIR, "reach"), 0o755);
  fs.chmodSync(path.join(RELEASE_DIR, "install.sh"), 0o755);

  writeChecksums([binary, "reach"]);

  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), "reach-install-"));
  console.log(`Running install.sh smoke into ${installDir} ...`);
  run("bash", [path.join(RELEASE_DIR, "install.sh")], {
    cwd: ROOT,
    env: {
      ...process.env,
      INSTALL_DIR: installDir,
      REACH_RELEASE_DIR: RELEASE_DIR,
      REACH_VERSION: fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim(),
    },
  });
  run(path.join(installDir, "reach"), ["version"]);
  runAllowingDoctorFailure(path.join(installDir, "reach"), ["doctor"]);

  const pwsh = spawnSync(
    "pwsh",
    ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"],
    {
      encoding: "utf8",
    },
  );
  if (pwsh.status === 0) {
    const winInstallDir = fs.mkdtempSync(path.join(os.tmpdir(), "reach-install-ps-"));
    console.log(`Running install.ps1 smoke into ${winInstallDir} ...`);
    run(
      "pwsh",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(RELEASE_DIR, "install.ps1"),
        "-Version",
        fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim(),
        "-InstallDir",
        winInstallDir,
        "-ReleaseDir",
        RELEASE_DIR,
      ],
      { cwd: ROOT },
    );
  } else {
    console.log("PowerShell not available; skipping install.ps1 smoke.");
  }

  console.log("✅ verify:installers passed");
}

main();
