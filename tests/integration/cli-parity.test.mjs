#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const TMP = mkdtempSync(path.join(tmpdir(), "reach-cli-parity-"));

const ENTERPRISE_KEYS = [
  "REACH_CLOUD_ENABLED",
  "REACH_CLOUD",
  "BILLING_ENABLED",
  "REACH_ENTERPRISE_URL",
  "REACH_ENTERPRISE_TOKEN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function fail(message, details = "") {
  console.error(`FAIL: ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function makeOssEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of ENTERPRISE_KEYS) {
    delete env[key];
  }
  return env;
}

function run(binary, args, env = process.env, timeout = 60000) {
  const result = spawnSync(binary, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    fail(`${label} is not valid JSON`, `${err}\nOutput:\n${text}`);
  }
}

function findBinary() {
  if (process.env.REACHCTL_BIN && existsSync(process.env.REACHCTL_BIN)) {
    return process.env.REACHCTL_BIN;
  }

  const candidates = [
    path.join(ROOT, "build", "reachctl"),
    path.join(ROOT, "build", "reachctl.exe"),
    path.join(ROOT, "services", "runner", "reachctl"),
    path.join(ROOT, "services", "runner", "reachctl.exe"),
    path.join(ROOT, "reachctl"),
    path.join(ROOT, "reachctl.exe"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.toLowerCase().includes(needle.toLowerCase())) {
    fail(`${label} missing '${needle}'`, haystack.slice(0, 800));
  }
}

function artifactExistsCrossPlatform(reportedPath) {
  const candidates = [reportedPath];

  if (reportedPath.startsWith("/mnt/")) {
    candidates.push(`/mnt/c${reportedPath}`);
  }
  if (/^[A-Za-z]:\\/.test(reportedPath)) {
    const drive = reportedPath[0].toLowerCase();
    const rest = reportedPath.slice(2).replace(/\\/g, "/");
    candidates.push(`/mnt/${drive}${rest}`);
  }

  return candidates.some((candidate) => existsSync(candidate));
}

function main() {
  const binary = findBinary();
  if (!binary) {
    fail("reachctl binary not found for integration test");
  }

  const ossEnv = makeOssEnv({
    REACH_DATA_DIR: path.join(TMP, "data"),
  });

  const help = run(binary, ["--help"], ossEnv);
  const helpText = `${help.stdout}\n${help.stderr}`;
  for (const command of ["version", "demo", "quickstart", "status", "bugreport", "capsule"]) {
    assertIncludes(helpText, command, "help output");
  }

  const version = run(binary, ["version"], ossEnv);
  if (version.status !== 0) {
    fail("version command failed", `${version.stderr}\n${version.stdout}`);
  }
  assertIncludes(version.stdout, "Version:", "version output");
  if (!/\b\d+\.\d+\.\d+\b|\bdev\b/.test(version.stdout)) {
    fail("version output missing semantic version/dev marker", version.stdout);
  }

  const status = run(binary, ["status", "--json"], ossEnv);
  if (status.status !== 0) {
    fail("status command failed in OSS mode", `${status.stderr}\n${status.stdout}`);
  }
  const statusPayload = parseJson(status.stdout, "status output");
  if (statusPayload.mode !== "oss") {
    fail("status mode should be oss when enterprise env is absent", status.stdout);
  }

  const demo = run(binary, ["demo", "smoke", "--json"], ossEnv);
  if (demo.status !== 0) {
    assertIncludes(`${demo.stdout}\n${demo.stderr}`, "error[DEMO_PREREQ]", "demo typed error");
  } else {
    const demoPayload = parseJson(demo.stdout, "demo output");
    if (!demoPayload.run_id) {
      fail("demo output missing run_id", demo.stdout);
    }
    if (demoPayload.verified !== true || demoPayload.replay_verified !== true) {
      fail("demo did not verify/replay successfully", demo.stdout);
    }
  }

  const secret = "top-secret-cli-parity-token";
  const bugPath = path.join(ROOT, ".artifacts", "cli-parity", "reach-bugreport.zip");
  const bug = run(
    binary,
    ["bugreport", "--output", bugPath, "--json"],
    makeOssEnv({
      REACH_DATA_DIR: path.join(TMP, "bug-data"),
      REACH_API_SECRET: secret,
    }),
  );
  if (bug.status !== 0) {
    fail("bugreport command failed", `${bug.stderr}\n${bug.stdout}`);
  }
  if (bug.stdout.includes(secret) || bug.stderr.includes(secret)) {
    fail("bugreport leaked secret in output", `${bug.stdout}\n${bug.stderr}`);
  }
  const bugPayload = parseJson(bug.stdout, "bugreport output");
  if (!bugPayload.bugreport) {
    fail("bugreport output missing artifact path", bug.stdout);
  }
  if (!artifactExistsCrossPlatform(bugPayload.bugreport)) {
    fail("bugreport artifact was not created", bug.stdout);
  }

  const capsuleHelp = run(binary, ["capsule", "--help"], ossEnv);
  if (capsuleHelp.status !== 0) {
    fail("capsule --help failed", `${capsuleHelp.stderr}\n${capsuleHelp.stdout}`);
  }
  const capsuleText = `${capsuleHelp.stdout}\n${capsuleHelp.stderr}`;
  assertIncludes(capsuleText, "create <runId>", "capsule help");
  assertIncludes(capsuleText, "verify <file>", "capsule help");
  assertIncludes(capsuleText, "replay <file>", "capsule help");

  console.log(`PASS: CLI parity integration checks passed using ${binary}`);
}

main();
