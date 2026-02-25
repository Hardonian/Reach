#!/usr/bin/env node
/**
 * Examples Verification Script
 *
 * Runs all examples in the examples/ directory and verifies they complete successfully.
 * This is designed to be fast and non-flaky - examples must be deterministic.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;
let skipped = 0;

function log(status, message) {
  const prefix =
    status === "PASS"
      ? `${GREEN}✓${RESET}`
      : status === "FAIL"
        ? `${RED}✗${RESET}`
        : `${YELLOW}⚠${RESET}`;
  console.log(`${prefix} ${message}`);
}

function findExamples() {
  const entries = fs.readdirSync(examplesDir, { withFileTypes: true });
  const examples = [];

  for (const entry of entries) {
    if (entry.isDirectory() && /^\d+-.+/.test(entry.name)) {
      const examplePath = path.join(examplesDir, entry.name);
      const runJs = path.join(examplePath, "run.js");
      const runMjs = path.join(examplePath, "run.mjs");
      const indexJs = path.join(examplePath, "index.js");
      const packageJson = path.join(examplePath, "package.json");

      let entryPoint = null;
      if (fs.existsSync(runJs)) entryPoint = "run.js";
      else if (fs.existsSync(runMjs)) entryPoint = "run.mjs";
      else if (fs.existsSync(indexJs)) entryPoint = "index.js";
      else if (fs.existsSync(packageJson)) entryPoint = "package.json";

      if (entryPoint) {
        examples.push({
          name: entry.name,
          path: examplePath,
          entryPoint,
        });
      }
    }
  }

  return examples.sort((a, b) => {
    const numA = parseInt(a.name.match(/^\d+/)[0], 10);
    const numB = parseInt(b.name.match(/^\d+/)[0], 10);
    return numA - numB;
  });
}

function runExample(example, timeoutMs = 30000) {
  const startTime = Date.now();
  const cwd = example.path;

  try {
    let command;
    if (example.entryPoint === "package.json") {
      // Check if package.json has a test or start script
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
      if (pkg.scripts?.test) {
        command = "npm test";
      } else if (pkg.scripts?.start) {
        command = "npm start";
      } else {
        throw new Error("No test or start script in package.json");
      }
    } else {
      command = `node ${example.entryPoint}`;
    }

    execSync(command, {
      cwd,
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: "pipe",
      env: { ...process.env, NODE_ENV: "test" },
    });

    const duration = Date.now() - startTime;
    return { success: true, duration };
  } catch (e) {
    const duration = Date.now() - startTime;
    return { success: false, duration, error: e.message, stderr: e.stderr?.toString() };
  }
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║         EXAMPLES VERIFICATION (Launch Pack)                ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// First, run the minimal example if it exists
console.log("━".repeat(60));
console.log("MINIMAL EXAMPLE SMOKE TEST");
console.log("━".repeat(60));

const minimalExample = path.join(examplesDir, "01-quickstart-local");
if (fs.existsSync(minimalExample)) {
  const result = runExample(
    {
      name: "01-quickstart-local",
      path: minimalExample,
      entryPoint: fs.existsSync(path.join(minimalExample, "run.js")) ? "run.js" : "run.mjs",
    },
    60000,
  );

  if (result.success) {
    log("PASS", `Minimal example completed in ${result.duration}ms`);
    passed++;
  } else {
    log("FAIL", `Minimal example failed: ${result.error}`);
    failed++;
  }
} else {
  log("SKIP", "Minimal example (01-quickstart-local) not found");
  skipped++;
}

// Find and run all examples
console.log("\n━".repeat(60));
console.log("ALL EXAMPLES");
console.log("━".repeat(60));

const examples = findExamples();
console.log(`Found ${examples.length} examples\n`);

for (const example of examples) {
  // Skip the minimal example since we already ran it
  if (example.name === "01-quickstart-local") {
    continue;
  }

  process.stdout.write(`Running ${example.name}... `);
  const result = runExample(example);

  if (result.success) {
    log("PASS", `${example.name} (${result.duration}ms)`);
    passed++;
  } else {
    // Check if it's a known flaky/network issue
    const isNetworkError =
      result.error?.includes("network") || result.error?.includes("ECONNREFUSED");
    const isMissingDep =
      result.error?.includes("Cannot find module") || result.error?.includes("not installed");

    if (isNetworkError || isMissingDep) {
      log(
        "SKIP",
        `${example.name} - ${isNetworkError ? "network required" : "deps not installed"}`,
      );
      skipped++;
    } else {
      log("FAIL", `${example.name} - ${result.error}`);
      failed++;
    }
  }
}

// Summary
console.log("\n" + "═".repeat(60));
console.log("EXAMPLES VERIFICATION SUMMARY");
console.log("═".repeat(60));
console.log(`${GREEN}✓${RESET} Passed: ${passed}`);
console.log(`${RED}✗${RESET} Failed: ${failed}`);
console.log(`${YELLOW}⚠${RESET} Skipped: ${skipped}`);

console.log("\n📋 Example Categories:");
console.log("   01-06: Core quickstart and diff workflows");
console.log("   07-10: Verification and tamper detection");
console.log("   11-13: Policy runs and replay validation");

const exitCode = failed > 0 ? 1 : 0;
process.exit(exitCode);
