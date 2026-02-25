#!/usr/bin/env node
/**
 * CLI Commands Smoke Test
 *
 * Verifies that all documented CLI commands are reachable and return expected output.
 * This test ensures documentation matches actual implementation.
 *
 * Usage: node tests/smoke/cli-commands.test.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");

// Test configuration
const REACH_SCRIPT = resolve(REPO_ROOT, "reach");
const REACHCTL_BIN = resolve(REPO_ROOT, "reachctl.exe");

// Color codes
const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
};

// Results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [],
};

function log(msg, color = C.reset) {
  console.log(`${color}${msg}${C.reset}`);
}

async function runCommand(cmd, args = [], options = {}) {
  const { timeout = 30000, expectFailure = false } = options;

  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      timeout,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      resolve({
        success: false,
        exitCode: -1,
        stdout,
        stderr: err.message,
        error: err,
      });
    });

    child.on("close", (code) => {
      const success = expectFailure ? code !== 0 : code === 0;
      resolve({
        success,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });
}

async function testCliCommand(name, command, args = [], options = {}) {
  const { shouldExist = true, checkOutput = null } = options;

  process.stdout.write(`  Testing: reach ${command} ... `);

  let cmd, cmdArgs;
  if (existsSync(REACH_SCRIPT)) {
    cmd = "bash";
    cmdArgs = [REACH_SCRIPT, command, ...args];
  } else if (existsSync(REACHCTL_BIN)) {
    cmd = REACHCTL_BIN;
    cmdArgs = [command, ...args];
  } else {
    console.log(`${C.yellow}SKIP (no CLI binary)${C.reset}`);
    results.skipped++;
    results.tests.push({ name, command, status: "SKIP", reason: "No CLI binary found" });
    return;
  }

  const result = await runCommand(cmd, cmdArgs, options);

  // Determine pass/fail
  let passed = result.success;
  let message = "";

  if (checkOutput && passed) {
    const outputCheck = checkOutput(result.stdout, result.stderr);
    passed = outputCheck.passed;
    message = outputCheck.message || "";
  }

  // If command shouldn't exist (we test negative cases too)
  if (!shouldExist) {
    passed = !result.success;
    message = "Command correctly rejected";
  }

  if (passed) {
    console.log(`${C.green}PASS${C.reset}${message ? " - " + message : ""}`);
    results.passed++;
  } else {
    console.log(`${C.red}FAIL${C.reset}${message ? " - " + message : ""}`);
    if (result.stderr) {
      console.log(`    stderr: ${result.stderr.slice(0, 100)}...`);
    }
    results.failed++;
  }

  results.tests.push({
    name,
    command,
    status: passed ? "PASS" : "FAIL",
    exitCode: result.exitCode,
    message,
  });
}

async function main() {
  log("\n═══════════════════════════════════════════════════════════════", C.blue);
  log("           CLI COMMANDS SMOKE TEST", C.blue);
  log("═══════════════════════════════════════════════════════════════", C.blue);
  log("");

  // Check prerequisites
  if (!existsSync(REACH_SCRIPT) && !existsSync(REACHCTL_BIN)) {
    log("⚠️  No Reach CLI found. Checked:", C.yellow);
    log(`   - ${REACH_SCRIPT}`, C.gray);
    log(`   - ${REACHCTL_BIN}`, C.gray);
    log("\nSkipping CLI smoke tests.\n", C.yellow);
    process.exit(0);
  }

  log("Core Commands:");

  // version command
  await testCliCommand("version", "version", [], {
    checkOutput: (stdout) => ({
      passed: stdout.includes("0.") || stdout.match(/\d+\.\d+/),
      message: "Version number present",
    }),
  });

  // doctor command
  await testCliCommand("doctor", "doctor", [], {
    checkOutput: (stdout, stderr) => ({
      passed: stdout.includes("health") || stdout.includes("check") || stderr.includes("health"),
      message: "Health check indicators present",
    }),
  });

  // demo command (may fail in some environments, that's OK)
  await testCliCommand("demo", "demo", [], {
    checkOutput: (stdout, stderr) => ({
      passed: stdout.length > 0 || stderr.length > 0,
      message: "Produces output",
    }),
  });

  // quickstart command
  await testCliCommand("quickstart", "quickstart", [], {
    checkOutput: (stdout) => ({
      passed: stdout.length > 0,
      message: "Produces output",
    }),
  });

  // status command
  await testCliCommand("status", "status", [], {
    checkOutput: (stdout) => ({
      passed: stdout.length > 0,
      message: "Produces output",
    }),
  });

  // bugreport command
  await testCliCommand("bugreport", "bugreport", ["--help"], {
    checkOutput: (stdout, stderr) => ({
      passed:
        stdout.includes("bugreport") || stderr.includes("bugreport") || stdout.includes("Usage"),
      message: "Help available",
    }),
  });

  log("\nDocumentation Commands:");

  // Help/usage
  await testCliCommand("help implicit", "--help", [], {
    checkOutput: (stdout) => ({
      passed: stdout.includes("Usage") || stdout.includes("help"),
      message: "Help text present",
    }),
  });

  // Summary
  log("\n" + "─".repeat(64), C.blue);
  log(`Results: ${results.passed} passed, ${results.failed} failed, ${results.skipped} skipped`);
  log("─".repeat(64) + "\n", C.blue);

  if (results.failed > 0) {
    log("Failed tests:", C.red);
    for (const test of results.tests.filter((t) => t.status === "FAIL")) {
      log(`  • ${test.name}: exit code ${test.exitCode}`, C.red);
    }
    log("");
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
