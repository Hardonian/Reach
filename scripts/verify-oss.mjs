#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const enterpriseLikeKeys = [
  "REACH_CLOUD_ENABLED",
  "REACH_CLOUD",
  "BILLING_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

function makeOssEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    if (enterpriseLikeKeys.includes(key) || key.startsWith("REACH_ENTERPRISE_")) {
      delete env[key];
    }
  }
  return env;
}

function run(command, args, env, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    stdio: options.stdio ?? "pipe",
    encoding: options.encoding ?? "utf8",
    env,
  });
  return result;
}

function fail(message, details = "") {
  console.error(`❌ ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function findReachctl() {
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

function findGoBinary() {
  const candidates = [];
  if (process.env.GO_BIN) candidates.push(process.env.GO_BIN);
  candidates.push("go", "go.exe");
  candidates.push("/mnt/c/Program Files/Go/bin/go.exe");
  for (const candidate of candidates) {
    const probe = run(candidate, ["version"], process.env);
    if ((probe.status ?? 1) === 0) {
      return candidate;
    }
  }
  return null;
}

function ensureBinary() {
  const existing = findReachctl();
  if (existing) return existing;

  const goBin = findGoBinary();
  if (!goBin) {
    fail("reachctl binary not found and Go toolchain is unavailable");
  }

  const versionProbe = run(goBin, ["version"], process.env);
  const versionText = `${versionProbe.stdout ?? ""}${versionProbe.stderr ?? ""}`;
  const outputLooksWindows =
    goBin.toLowerCase().endsWith(".exe") || versionText.includes("windows/");
  const output = outputLooksWindows
    ? path.join(ROOT, "reachctl.exe")
    : path.join(ROOT, "build", "reachctl");

  run(
    "node",
    [
      "-e",
      `require('node:fs').mkdirSync(${JSON.stringify(path.dirname(output))}, { recursive: true })`,
    ],
    process.env,
  );
  const build = run(
    goBin,
    ["build", "-trimpath", "-o", output, "./services/runner/cmd/reachctl"],
    process.env,
  );
  if ((build.status ?? 1) !== 0) {
    fail("failed to build reachctl for verify:oss", `${build.stdout}\n${build.stderr}`);
  }
  if (!existsSync(output)) {
    fail("go build reported success but reachctl output is missing", output);
  }

  return output;
}

function main() {
  const tempDir = mkdtempSync(path.join(tmpdir(), "reach-verify-oss-"));
  const env = makeOssEnv({ REACH_DATA_DIR: path.join(tempDir, "data") });

  console.log("Running verify:oss with enterprise env unset...");

  for (const script of ["scripts/validate-oss-purity.mjs", "scripts/verify-boundaries.mjs"]) {
    const result = run("node", [script], env, { stdio: "inherit", encoding: undefined });
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  const binary = ensureBinary();

  const status = run(binary, ["status", "--json"], env);
  if ((status.status ?? 1) !== 0) {
    fail("reachctl status failed in OSS mode", `${status.stdout}\n${status.stderr}`);
  }

  let payload;
  try {
    payload = JSON.parse(status.stdout || "{}");
  } catch (err) {
    fail("reachctl status output is not valid JSON", `${err}\n${status.stdout}`);
  }
  if (payload.mode !== "oss") {
    fail("reachctl status did not report OSS mode", status.stdout);
  }

  const demo = run(binary, ["demo", "smoke", "--json"], env);
  if ((demo.status ?? 1) !== 0) {
    const output = `${demo.stdout}\n${demo.stderr}`;
    if (!output.toLowerCase().includes("error[demo_prereq]")) {
      fail("reachctl demo smoke failed without typed prereq error", output);
    }
  }

  console.log("✅ verify:oss passed");
}

main();
