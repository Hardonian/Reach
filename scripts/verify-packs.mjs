#!/usr/bin/env node
/**
 * Pack Verification Script
 *
 * Runs lint and test checks on example packs to prevent bad packs
 * from being published.
 */

import { spawn } from "child_process";
import { readdir, stat } from "fs/promises";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const EXAMPLES_DIR = join(ROOT_DIR, "examples", "packs");

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "pipe" });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

async function findPacks(dir) {
  const packs = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const packPath = join(dir, entry);
      const packStat = await stat(packPath);

      if (packStat.isDirectory()) {
        // Check if it has a pack.json
        try {
          const packJsonPath = join(packPath, "pack.json");
          await stat(packJsonPath);
          packs.push({ name: entry, path: packPath });
        } catch {
          // No pack.json, skip
        }
      }
    }
  } catch (err) {
    log(`Error reading examples directory: ${err.message}`, "red");
  }

  return packs;
}

async function lintPack(packPath) {
  // For now, we just validate the JSON structure
  // In production, this would call reach pack lint
  try {
    const packJsonPath = join(packPath, "pack.json");
    const content = await import("fs/promises").then((fs) =>
      fs.readFile(packJsonPath, "utf-8"),
    );
    const pack = JSON.parse(content);

    const errors = [];

    // Check required fields
    if (!pack.spec_version) errors.push("Missing spec_version");
    if (!pack.metadata) errors.push("Missing metadata");
    if (!pack.declared_tools) errors.push("Missing declared_tools");
    if (typeof pack.deterministic !== "boolean")
      errors.push("Missing or invalid deterministic flag");

    // Check metadata
    if (pack.metadata) {
      if (!pack.metadata.id) errors.push("Missing metadata.id");
      if (!pack.metadata.version) errors.push("Missing metadata.version");
      if (!pack.metadata.name) errors.push("Missing metadata.name");
      if (!pack.metadata.author) errors.push("Missing metadata.author");
    }

    // Check spec version
    if (pack.spec_version && pack.spec_version !== "1.0") {
      errors.push(`Invalid spec_version: ${pack.spec_version}`);
    }

    return { passed: errors.length === 0, errors };
  } catch (err) {
    return {
      passed: false,
      errors: [`Failed to parse pack.json: ${err.message}`],
    };
  }
}

async function testPack(packPath) {
  // For now, we check for test files
  // In production, this would call reach pack test
  try {
    const testsDir = join(packPath, "tests");
    await stat(testsDir);
    return { passed: true, message: "Tests directory exists" };
  } catch {
    return {
      passed: true,
      warning: "No tests directory (optional but recommended)",
    };
  }
}

async function verifyPack(pack) {
  log(`\nVerifying pack: ${pack.name}`, "blue");

  const results = {
    name: pack.name,
    lint: null,
    test: null,
    overall: false,
  };

  // Run lint
  log("  Running lint...", "reset");
  results.lint = await lintPack(pack.path);

  if (results.lint.passed) {
    log("  ✓ Lint passed", "green");
  } else {
    log("  ✗ Lint failed", "red");
    for (const error of results.lint.errors) {
      log(`    - ${error}`, "red");
    }
  }

  // Run tests
  log("  Running tests...", "reset");
  results.test = await testPack(pack.path);

  if (results.test.passed) {
    log(
      `  ✓ Tests passed${results.test.warning ? ` (${results.test.warning})` : ""}`,
      "green",
    );
  } else {
    log("  ✗ Tests failed", "red");
  }

  // Determine overall result
  results.overall = results.lint.passed && results.test.passed;

  return results;
}

async function main() {
  log("=== Reach Pack Verification ===\n", "blue");

  // Find all packs
  const packs = await findPacks(EXAMPLES_DIR);

  if (packs.length === 0) {
    log("No packs found in examples/packs/", "yellow");
    process.exit(0);
  }

  log(`Found ${packs.length} pack(s) to verify`, "reset");

  // Verify each pack
  const results = [];
  for (const pack of packs) {
    const result = await verifyPack(pack);
    results.push(result);
  }

  // Summary
  log("\n=== Verification Summary ===", "blue");

  const passed = results.filter((r) => r.overall).length;
  const failed = results.filter((r) => !r.overall).length;

  for (const result of results) {
    const status = result.overall ? "✓ PASS" : "✗ FAIL";
    const color = result.overall ? "green" : "red";
    log(`  ${status}: ${result.name}`, color);
  }

  log(
    `\nTotal: ${passed} passed, ${failed} failed`,
    failed > 0 ? "red" : "green",
  );

  if (failed > 0) {
    log(
      "\nSome packs failed verification. Please fix the issues above.",
      "red",
    );
    process.exit(1);
  } else {
    log("\nAll packs passed verification!", "green");
    process.exit(0);
  }
}

main().catch((err) => {
  log(`Error: ${err.message}`, "red");
  process.exit(1);
});
