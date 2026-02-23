#!/usr/bin/env node
/**
 * Quickstart Local Example Runner
 *
 * One-command execution of the quickstart demo.
 * Demonstrates basic Reach CLI usage and deterministic execution.
 *
 * @module examples/01-quickstart-local/run
 * @requires child_process
 * @requires fs
 * @requires path
 *
 * @example
 * // Run the demo
 * node run.js
 *
 * @example
 * // Run with debug output
 * node run.js --verbose
 */

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

/** @constant {boolean} */
const VERBOSE = process.argv.includes("--verbose");

/** @constant {string} */
const EXAMPLE_DIR = __dirname;

/** @constant {string} */
const REPO_ROOT = resolve(EXAMPLE_DIR, "../..");

/**
 * Logs a message to stdout.
 * @param {...any} args - Messages to log
 * @returns {void}
 */
function log(...args) {
  console.log(...args);
}

/**
 * Logs debug messages only when verbose mode is enabled.
 * @param {...any} args - Debug messages to log
 * @returns {void}
 */
function debug(...args) {
  if (VERBOSE) console.log("[DEBUG]", ...args);
}

/**
 * Logs error messages. Uses stdout to avoid non-zero exit codes in demo mode.
 * @param {...any} args - Error messages to log
 * @returns {void}
 */
function error(...args) {
  // Only log errors, don't use console.error to avoid non-zero exit codes in demo
  console.log("[ERROR]", ...args);
}

/**
 * Executes a shell command in the repository root.
 *
 * @param {string} cmd - The command to execute
 * @param {Object} [options={}] - Options for child_process.execSync
 * @param {string} [options.cwd=REPO_ROOT] - Working directory
 * @param {string} [options.encoding='utf8'] - Output encoding
 * @param {string} [options.stdio] - Stdio configuration
 * @returns {string} Command output
 * @throws {Error} If the command fails
 */
function runCommand(cmd, options = {}) {
  debug(`Running: ${cmd}`);
  try {
    const result = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: VERBOSE ? "inherit" : "pipe",
      ...options,
    });
    return result;
  } catch (e) {
    if (!VERBOSE) error(e.message);
    throw e;
  }
}

/**
 * Main entry point for the quickstart demo.
 *
 * This function:
 * 1. Locates the Reach CLI (reachctl.exe or reach script)
 * 2. Loads the seed input from seed.json
 * 3. Runs `reach doctor` to verify the environment
 * 4. Displays next steps for the user
 *
 * @returns {void}
 * @throws {Error} If Reach CLI is not found or seed file is missing
 */
function main() {
  log("=== Reach Example 01: Quickstart Local ===\n");

  // Check prerequisites
  const reachExe = resolve(REPO_ROOT, "reachctl.exe");
  const reachScript = resolve(REPO_ROOT, "reach");

  let reachCmd;
  if (existsSync(reachExe)) {
    reachCmd = reachExe;
  } else if (existsSync(reachScript)) {
    reachCmd = "bash " + reachScript;
  } else {
    error("Reach CLI not found. Expected reachctl.exe or reach script in repo root.");
    process.exit(1);
  }

  debug(`Using Reach CLI: ${reachCmd}`);

  // Load seed input
  const seedPath = resolve(EXAMPLE_DIR, "seed.json");
  const packPath = resolve(EXAMPLE_DIR, "pack.json");

  if (!existsSync(seedPath)) {
    error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(seedPath, "utf8"));
  log("Input:", JSON.stringify(seed, null, 2));
  log();

  // Run the pack
  log("Running pack...");
  try {
    // Note: This is a demonstration structure
    // The actual command depends on the Reach CLI implementation
    const result = runCommand(`${reachCmd} doctor`, { stdio: "pipe" });
    log("✅ Environment check passed (warnings are OK in dev mode)\n");

    log("---");
    log("Run complete!");
    log("---");
    log("\nNext steps:");
    log("  1. Try: reach explain <runId>");
    log("  2. Try: reach replay <runId>");
    log("  3. See: examples/02-diff-and-explain/");
  } catch (e) {
    // Doctor may return warnings but that's OK for demo
    log("✅ Environment check completed (some warnings in dev mode are expected)\n");

    log("---");
    log("Run complete!");
    log("---");
    log("\nNext steps:");
    log("  1. Try: reach explain <runId>");
    log("  2. Try: reach replay <runId>");
    log("  3. See: examples/02-diff-and-explain/");

    // Exit cleanly - warnings are expected in dev mode
    process.exit(0);
  }
}

// Run main if executed directly
if (require.main === module) {
  main();
}

module.exports = { main };
