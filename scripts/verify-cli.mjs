#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function fail(message, details = "") {
  console.error(`❌ ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.error) {
    return { ok: false, result, output: result.error.message };
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return { ok: result.status === 0, result, output };
}

function commandWorks(cmd, args) {
  const probe = run(cmd, args);
  return probe.ok;
}

function findGoBinary() {
  const candidates = [];
  if (process.env.GO_BIN) {
    candidates.push(process.env.GO_BIN);
  }

  candidates.push("go", "go.exe");

  const windowsGo = "C:\\Program Files\\Go\\bin\\go.exe";
  const wslGo = "/mnt/c/Program Files/Go/bin/go.exe";
  if (existsSync(windowsGo)) {
    candidates.push(windowsGo);
  }
  if (existsSync(wslGo)) {
    candidates.push(wslGo);
  }

  for (const candidate of candidates) {
    if (commandWorks(candidate, ["version"])) {
      return candidate;
    }
  }

  return null;
}

function resolveOutputPath(goBin) {
  const version = run(goBin, ["version"]);
  const outputLooksWindows = goBin.toLowerCase().endsWith(".exe") || version.output.includes("windows/");
  return outputLooksWindows ? path.join(ROOT, "reachctl.exe") : path.join(ROOT, "build", "reachctl");
}

function buildCli(goBin, outBin) {
  const mkdir = run("node", [
    "-e",
    `require('node:fs').mkdirSync(${JSON.stringify(path.dirname(outBin))}, { recursive: true })`,
  ]);
  if (!mkdir.ok) {
    fail("failed to create output directory", mkdir.output);
  }

  const build = run(goBin, ["build", "-trimpath", "-o", outBin, "./services/runner/cmd/reachctl"]);
  if (!build.ok) {
    fail("go build failed for reachctl", build.output);
  }
  if (!existsSync(outBin)) {
    fail("go build reported success but output binary is missing", outBin);
  }
}

function assertWrapperDelegates() {
  const wrapperPath = path.join(ROOT, "reach");
  if (!existsSync(wrapperPath)) {
    fail("wrapper script 'reach' not found");
  }

  const content = readFileSync(wrapperPath, "utf8");
  const forbidden = [
    "run_demo_smoke_fallback",
    "run_bugreport_fallback",
    "scripts/reach-status.mjs",
    "scripts/quickstart-demo.mjs",
  ];

  const found = forbidden.filter((token) => content.includes(token));
  if (found.length > 0) {
    fail("wrapper still contains command logic that should live in reachctl", found.join("\n"));
  }
}

function main() {
  console.log("🔍 verify:cli - building CLI and running parity integration checks");

  const goBin = findGoBinary();
  if (!goBin) {
    fail("Go toolchain not found. Set GO_BIN or add Go to PATH.");
  }
  console.log(`✓ go binary: ${goBin}`);

  const outBin = resolveOutputPath(goBin);
  buildCli(goBin, outBin);
  console.log(`✓ built: ${outBin}`);

  assertWrapperDelegates();
  console.log("✓ wrapper delegation checks passed");

  const integration = run("node", ["tests/integration/cli-parity.test.mjs"], {
    env: { ...process.env, REACHCTL_BIN: outBin },
    stdio: "inherit",
  });
  if (!integration.ok) {
    fail("CLI parity integration test failed");
  }

  console.log("✅ verify:cli passed");
}

main();
