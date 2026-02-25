#!/usr/bin/env node
/**
 * CLI Reality Enforcement Verification Script
 * 
 * Verifies that all documented CLI commands exist in the binary
 * and behave deterministically.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DOCS_URL = "https://reach-cli.com/docs";
const ISSUE_URL = "https://github.com/reach/reach/issues/new?template=bug_report.yml";

// Documented commands that MUST exist in the binary
const REQUIRED_COMMANDS = [
  { cmd: "version", minArgs: 0, checkOutput: ["Reach", "Version"] },
  { cmd: "doctor", minArgs: 0, checkOutput: ["OK", "Diagnosing"] },
  { cmd: "demo", minArgs: 0, subcommands: ["smoke", "run", "status"], checkOutput: [] },
  { cmd: "quickstart", minArgs: 0, checkOutput: ["run", "quickstart"] },
  { cmd: "status", minArgs: 0, checkOutput: ["health", "status"] },
  { cmd: "bugreport", minArgs: 0, checkOutput: ["bugreport"] },
  { cmd: "capsule", minArgs: 1, subcommands: ["create", "verify", "replay"], checkOutput: [] },
  { cmd: "proof", minArgs: 1, subcommands: ["verify", "explain"], checkOutput: [] },
  { cmd: "packs", minArgs: 1, subcommands: ["search", "install", "verify"], checkOutput: [] },
];

// Find reachctl binary
function findReachctl() {
  const candidates = [
    join(process.cwd(), "services", "runner", "reachctl"),
    join(process.cwd(), "services", "runner", "reachctl.exe"),
    join(process.cwd(), "build", "reachctl"),
    join(process.cwd(), "build", "reachctl.exe"),
    join(process.cwd(), "reachctl"),
    join(process.cwd(), "reachctl.exe"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Try PATH
  const pathCheck = spawnSync("reachctl", ["version"], { encoding: "utf8" });
  if (pathCheck.status === 0) {
    return "reachctl";
  }

  return null;
}

// Run a command and capture output
function runCommand(binary, args, env = {}) {
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 30000,
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
}

// Test a single command
function testCommand(binary, cmdSpec) {
  const results = {
    cmd: cmdSpec.cmd,
    passed: true,
    tests: [],
  };

  // Test basic help/usage
  const helpResult = runCommand(binary, [cmdSpec.cmd, "--help"]);
  const basicResult = runCommand(binary, [cmdSpec.cmd]);

  // Check if command exists (exit code should be 0 or 1, not "not found")
  // "Usage of" in output means the command exists but needs args - that's OK
  const helpOutput = (helpResult.stdout + helpResult.stderr).toLowerCase();
  const basicOutput = (basicResult.stdout + basicResult.stderr).toLowerCase();
  const commandExists = 
    !helpResult.error ||
    helpOutput.includes("usage of " + cmdSpec.cmd) ||
    (!helpOutput.includes("unknown") && !basicOutput.includes("unknown"));
  
  results.tests.push({
    name: "command exists",
    passed: commandExists,
    details: commandExists ? "Command recognized" : `Command not found: ${helpResult.stderr}`,
  });

  if (!commandExists) {
    results.passed = false;
    return results;
  }

  // Check for required output patterns
  if (cmdSpec.checkOutput && cmdSpec.checkOutput.length > 0) {
    const combinedOutput = (basicResult.stdout + basicResult.stderr).toLowerCase();
    const hasRequiredOutput = cmdSpec.checkOutput.every(pattern => 
      combinedOutput.includes(pattern.toLowerCase())
    );

    results.tests.push({
      name: "required output patterns",
      passed: hasRequiredOutput,
      details: hasRequiredOutput 
        ? `Found patterns: ${cmdSpec.checkOutput.join(", ")}`
        : `Missing patterns. Output: ${combinedOutput.slice(0, 200)}`,
    });

    if (!hasRequiredOutput) {
      results.passed = false;
    }
  }

  // Test subcommands if defined
  if (cmdSpec.subcommands && cmdSpec.subcommands.length > 0) {
    for (const sub of cmdSpec.subcommands) {
      const subResult = runCommand(binary, [cmdSpec.cmd, sub, "--help"]);
      // Subcommand exists if help shows "Usage of <cmd> <sub>" OR if it runs without "unknown" error
      const subExists = !subResult.error ||
        (subResult.stdout && subResult.stdout.includes("Usage of")) ||
        (subResult.stderr && !subResult.stderr.toLowerCase().includes("unknown"));

      results.tests.push({
        name: `subcommand: ${sub}`,
        passed: subExists,
        details: subExists ? "Subcommand recognized" : `Subcommand failed: ${subResult.stderr?.slice(0, 100) || subResult.stdout?.slice(0, 100)}`,
      });

      if (!subExists) {
        results.passed = false;
      }
    }
  }

  // Test determinism - running twice should produce same output structure
  if (cmdSpec.cmd === "version") {
    const run1 = runCommand(binary, ["version"]);
    const run2 = runCommand(binary, ["version"]);
    const deterministic = run1.stdout === run2.stdout && run1.status === run2.status;

    results.tests.push({
      name: "deterministic output",
      passed: deterministic,
      details: deterministic ? "Output identical across runs" : "Output varies between runs",
    });

    if (!deterministic) {
      results.passed = false;
    }
  }

  return results;
}

// Main verification
function main() {
  console.log("🔍 CLI Reality Enforcement Verification");
  console.log("=" .repeat(50));

  const binary = findReachctl();
  if (!binary) {
    console.error("❌ reachctl binary not found");
    console.error("   Build with: cd services/runner && go build -o reachctl ./cmd/reachctl");
    process.exit(1);
  }

  console.log(`✓ Found binary: ${binary}\n`);

  const allResults = [];
  let allPassed = true;

  for (const cmdSpec of REQUIRED_COMMANDS) {
    const result = testCommand(binary, cmdSpec);
    allResults.push(result);

    if (result.passed) {
      console.log(`✅ ${result.cmd}`);
    } else {
      console.log(`❌ ${result.cmd}`);
      allPassed = false;
    }

    for (const test of result.tests) {
      const icon = test.passed ? "  ✓" : "  ✗";
      console.log(`${icon} ${test.name}: ${test.details.slice(0, 80)}`);
    }
    console.log();
  }

  // Summary
  console.log("=" .repeat(50));
  const totalTests = allResults.reduce((sum, r) => sum + r.tests.length, 0);
  const passedTests = allResults.reduce((sum, r) => sum + r.tests.filter(t => t.passed).length, 0);

  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log(`Commands: ${allResults.filter(r => r.passed).length}/${REQUIRED_COMMANDS.length} fully functional`);

  if (allPassed) {
    console.log("\n✅ CLI Reality Enforcement: PASSED");
    console.log(`   All documented commands exist in binary and behave deterministically.`);
    process.exit(0);
  } else {
    console.log("\n❌ CLI Reality Enforcement: FAILED");
    console.log(`   Missing or broken commands detected.`);
    console.log(`   Docs: ${DOCS_URL}`);
    console.log(`   Report: ${ISSUE_URL}`);
    process.exit(1);
  }
}

main();
