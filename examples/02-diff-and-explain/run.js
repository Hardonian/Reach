#!/usr/bin/env node
/**
 * Diff and Explain Example Runner
 *
 * Creates two runs with different inputs and shows the diff.
 * Usage: node run.js [--verbose]
 */

const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const VERBOSE = process.argv.includes("--verbose");
const EXAMPLE_DIR = __dirname;
const REPO_ROOT = resolve(EXAMPLE_DIR, "../..");

function log(...args) {
  console.log(...args);
}

function debug(...args) {
  if (VERBOSE) console.log("[DEBUG]", ...args);
}

function error(...args) {
  console.error("[ERROR]", ...args);
}

function runCommand(cmd, options = {}) {
  debug(`Running: ${cmd}`);
  try {
    const result = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: VERBOSE ? "inherit" : "pipe",
      ...options,
    });
    return result?.trim();
  } catch (e) {
    if (!VERBOSE) error(e.message);
    throw e;
  }
}

function main() {
  log("=== Reach Example 02: Diff and Explain ===\n");

  const reachExe = resolve(REPO_ROOT, "reachctl.exe");
  const reachScript = resolve(REPO_ROOT, "reach");

  let reachCmd;
  if (existsSync(reachExe)) {
    reachCmd = reachExe;
  } else if (existsSync(reachScript)) {
    reachCmd = "bash " + reachScript;
  } else {
    error("Reach CLI not found.");
    process.exit(1);
  }

  // Load and display inputs
  const v1Path = resolve(EXAMPLE_DIR, "seed-v1.json");
  const v2Path = resolve(EXAMPLE_DIR, "seed-v2.json");

  const v1 = JSON.parse(readFileSync(v1Path, "utf8"));
  const v2 = JSON.parse(readFileSync(v2Path, "utf8"));

  log("--- Input V1 (Baseline) ---");
  log(`Priority: ${v1.priority}`);
  log(`CPU: ${v1.input.metrics.cpu_utilization}%`);
  log(`Health: ${v1.input.resources[0].health}`);
  log(`Alerts: ${v1.input.alerts.length}`);
  log();

  log("--- Input V2 (Modified) ---");
  log(`Priority: ${v2.priority}`);
  log(`CPU: ${v2.input.metrics.cpu_utilization}%`);
  log(`Health: ${v2.input.resources[0].health}`);
  log(`Alerts: ${v2.input.alerts.length}`);
  log();

  // Show expected differences
  log("--- Expected Differences ---");
  const diff = JSON.parse(
    readFileSync(resolve(EXAMPLE_DIR, "expected-diff.json"), "utf8"),
  );
  log(`Fields changed: ${diff.fields_changed.length}`);
  diff.fields_changed.forEach((f) => {
    log(`  ${f.path}: ${JSON.stringify(f.old)} → ${JSON.stringify(f.new)}`);
  });
  log();

  // Demo commands
  log("--- Commands to run manually ---");
  log("# Run V1 (baseline):");
  log(`reach run pack.json --input seed-v1.json --tag baseline`);
  log();
  log("# Run V2 (modified):");
  log(`reach run pack.json --input seed-v2.json --tag modified`);
  log();
  log("# Compare runs:");
  log(`reach diff-run <run-id-1> <run-id-2>`);
  log();
  log("# Explain V2 in context of V1:");
  log(`reach explain <run-id-2> --compare <run-id-1>`);
  log();

  log("✅ Demo complete!");
  log("\nNext: examples/03-junction-to-decision/");
}

if (require.main === module) {
  main();
}

module.exports = { main };
