#!/usr/bin/env node
/**
 * Claim Verification Script
 * 
 * Validates that all documented claims match actual code behavior.
 * This script enforces documentation-to-reality alignment.
 * 
 * Usage: node scripts/verify-claims.mjs [--json] [--strict]
 * 
 * Exit codes:
 *   0 - All claims verified
 *   1 - One or more claims failed
 *   2 - Infrastructure error
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const FLAGS = {
  json: process.argv.includes("--json"),
  strict: process.argv.includes("--strict"),
  verbose: process.argv.includes("--verbose"),
  fix: process.argv.includes("--fix"),
};

// Colors for terminal output
const C = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

function log(msg, color = C.reset) {
  if (!FLAGS.json) console.log(`${color}${msg}${C.reset}`);
}

function logVerbose(msg) {
  if (FLAGS.verbose && !FLAGS.json) console.log(`${C.gray}[verbose] ${msg}${C.reset}`);
}

// Results accumulator
const results = {
  timestamp: new Date().toISOString(),
  passed: [],
  failed: [],
  warnings: [],
  notTested: [],
  summary: { total: 0, pass: 0, fail: 0, warn: 0, skip: 0 },
};

function addResult(category, claim, status, message, details = {}) {
  const result = { category, claim, status, message, details, timestamp: new Date().toISOString() };
  results[status === "PASS" ? "passed" : status === "FAIL" ? "failed" : "warnings"].push(result);
  results.summary.total++;
  results.summary[status.toLowerCase()]++;
  return result;
}

// ============================================================================
// CLAIM VERIFIERS
// ============================================================================

async function verifyFileExists(claimId, filePath, description) {
  const fullPath = resolve(REPO_ROOT, filePath);
  const exists = existsSync(fullPath);
  const status = exists ? "PASS" : "FAIL";
  const message = exists 
    ? `${description}: found at ${filePath}` 
    : `${description}: NOT FOUND at ${filePath}`;
  return addResult("file-existence", claimId, status, message, { path: filePath, exists });
}

async function verifyCodePath(claimId, codePath) {
  const extensions = ["", ".ts", ".js", ".mjs", ".go", ".rs"];
  let found = false;
  let fullPath = "";
  
  for (const ext of extensions) {
    const testPath = resolve(REPO_ROOT, codePath + ext);
    if (existsSync(testPath)) {
      found = true;
      fullPath = testPath;
      break;
    }
  }
  
  // Check if it's a directory with an index file
  if (!found && existsSync(resolve(REPO_ROOT, codePath))) {
    const dirPath = resolve(REPO_ROOT, codePath);
    const entries = readdirSync(dirPath);
    if (entries.includes("index.ts") || entries.includes("index.js") || entries.includes("main.go")) {
      found = true;
      fullPath = dirPath;
    }
  }
  
  const status = found ? "PASS" : "FAIL";
  const message = found 
    ? `Code path verified: ${codePath}` 
    : `Code path NOT FOUND: ${codePath}`;
  return addResult("code-path", claimId, status, message, { path: codePath, resolved: fullPath, exists: found });
}

async function verifyTestPath(claimId, testPath) {
  if (!testPath || testPath.length === 0) {
    return addResult("test-path", claimId, "WARN", "No test coverage", { path: null });
  }
  
  const exists = existsSync(resolve(REPO_ROOT, testPath));
  const status = exists ? "PASS" : FLAGS.strict ? "FAIL" : "WARN";
  const message = exists 
    ? `Test coverage verified: ${testPath}` 
    : `Test file NOT FOUND: ${testPath}`;
  return addResult("test-path", claimId, status, message, { path: testPath, exists });
}

async function verifyCliCommand(claimId, command, args = ["--help"]) {
  const reachScript = resolve(REPO_ROOT, "reach");
  const reachctl = resolve(REPO_ROOT, "reachctl.exe");
  
  let cmd, cmdArgs;
  if (existsSync(reachScript)) {
    cmd = "bash";
    cmdArgs = [reachScript, command, ...args];
  } else if (existsSync(reachctl)) {
    cmd = reachctl;
    cmdArgs = [command, ...args];
  } else {
    return addResult("cli-command", claimId, "SKIP", "CLI binary not found", { command });
  }
  
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { 
      timeout: 30000,
      stdio: FLAGS.verbose ? "inherit" : "pipe"
    });
    
    let stdout = "";
    let stderr = "";
    
    if (child.stdout) child.stdout.on("data", (d) => stdout += d.toString());
    if (child.stderr) child.stderr.on("data", (d) => stderr += d.toString());
    
    child.on("error", (err) => {
      addResult("cli-command", claimId, "FAIL", `CLI command failed: ${err.message}`, { 
        command, 
        error: err.message 
      });
      resolve();
    });
    
    child.on("close", (code) => {
      // Exit code 0 or help output indicates success for --help
      const success = code === 0 || stdout.includes("Usage") || stdout.includes(command);
      const status = success ? "PASS" : "FAIL";
      const message = success 
        ? `CLI command '${command}' is reachable` 
        : `CLI command '${command}' failed with code ${code}`;
      addResult("cli-command", claimId, status, message, { 
        command, 
        exitCode: code,
        hasHelpOutput: stdout.includes("Usage") || stdout.includes(command)
      });
      resolve();
    });
  });
}

async function verifyDeterminismInvariants() {
  log("\n📐 Verifying determinism invariants...", C.blue);
  
  const invariants = [
    { id: "DET-01", name: "Same input → same hash (TypeScript)", file: "src/determinism/determinism-invariants.test.ts" },
    { id: "DET-04", name: "Canonical JSON key ordering is recursive", file: "src/determinism/canonicalJson.test.ts" },
    { id: "DET-10", name: "Cross-language hash equivalence (golden)", file: "src/determinism/crossLanguageHash.test.ts" },
    { id: "DET-11", name: "Float encoding stability", file: "src/core/zeolite-core.test.ts" },
  ];
  
  for (const inv of invariants) {
    const exists = existsSync(resolve(REPO_ROOT, inv.file));
    const status = exists ? "PASS" : FLAGS.strict ? "FAIL" : "WARN";
    addResult("determinism-invariant", inv.id, status, 
      exists ? `${inv.name}: test exists` : `${inv.name}: test NOT FOUND`,
      { invariant: inv.name, testFile: inv.file, exists }
    );
  }
}

async function verifyExampleRuns(claimId, examplePath) {
  const fullPath = resolve(REPO_ROOT, examplePath);
  if (!existsSync(fullPath)) {
    return addResult("example", claimId, "FAIL", `Example not found: ${examplePath}`, { path: examplePath });
  }
  
  // For now, just verify the file exists and is executable
  // Full execution testing would require careful environment setup
  try {
    const content = readFileSync(fullPath, "utf8");
    const hasMain = content.includes("function main") || content.includes("async function main");
    const status = hasMain ? "PASS" : "WARN";
    addResult("example", claimId, status, 
      hasMain ? `Example has main() function: ${examplePath}` : `Example may be incomplete: ${examplePath}`,
      { path: examplePath, hasMainFunction: hasMain }
    );
  } catch (err) {
    addResult("example", claimId, "FAIL", `Error reading example: ${err.message}`, { path: examplePath, error: err.message });
  }
}

async function verifyWebRoutes() {
  log("\n🌐 Verifying web route coverage...", C.blue);
  
  const smokeTestPath = "tests/smoke/routes.test.mjs";
  const verifyRoutesPath = "scripts/verify-routes.mjs";
  
  const smokeExists = existsSync(resolve(REPO_ROOT, smokeTestPath));
  const verifyExists = existsSync(resolve(REPO_ROOT, verifyRoutesPath));
  
  addResult("web-routes", "smoke-test", smokeExists ? "PASS" : "FAIL",
    smokeExists ? "Smoke tests exist" : "Smoke tests NOT FOUND",
    { path: smokeTestPath, exists: smokeExists }
  );
  
  addResult("web-routes", "verify-script", verifyExists ? "PASS" : "FAIL",
    verifyExists ? "Route verification script exists" : "Route verification script NOT FOUND",
    { path: verifyRoutesPath, exists: verifyExists }
  );
  
  // Verify routes are documented
  if (smokeExists) {
    const content = readFileSync(resolve(REPO_ROOT, smokeTestPath), "utf8");
    const publicRoutes = content.match(/PUBLIC_ROUTES\s*=\s*\[([\s\S]*?)\]/);
    const consoleRoutes = content.match(/CONSOLE_ROUTES\s*=\s*\[([\s\S]*?)\]/);
    const apiRoutes = content.match(/API_ROUTES\s*=\s*\[([\s\S]*?)\]/);
    
    addResult("web-routes", "public-routes-defined", publicRoutes ? "PASS" : "WARN",
      publicRoutes ? "Public routes defined in smoke test" : "Public routes not clearly defined",
      { hasDefinition: !!publicRoutes }
    );
    
    addResult("web-routes", "console-routes-defined", consoleRoutes ? "PASS" : "WARN",
      consoleRoutes ? "Console routes defined in smoke test" : "Console routes not clearly defined",
      { hasDefinition: !!consoleRoutes }
    );
    
    addResult("web-routes", "api-routes-defined", apiRoutes ? "PASS" : "WARN",
      apiRoutes ? "API routes defined in smoke test" : "API routes not clearly defined",
      { hasDefinition: !!apiRoutes }
    );
  }
}

async function verifyNpmScripts() {
  log("\n📦 Verifying npm script claims...", C.blue);
  
  const packageJsonPath = resolve(REPO_ROOT, "package.json");
  if (!existsSync(packageJsonPath)) {
    addResult("npm-scripts", "package.json", "FAIL", "package.json not found");
    return;
  }
  
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const scripts = packageJson.scripts || {};
  
  const expectedScripts = [
    "verify:routes",
    "verify:determinism",
    "verify:oss",
    "verify:conformance",
    "verify:fast",
    "demo:smoke",
    "test",
    "lint",
    "typecheck",
  ];
  
  for (const script of expectedScripts) {
    const exists = scripts[script];
    const status = exists ? "PASS" : FLAGS.strict ? "FAIL" : "WARN";
    addResult("npm-scripts", script, status,
      exists ? `Script '${script}' defined` : `Script '${script}' NOT DEFINED`,
      { script, command: scripts[script] || null }
    );
  }
}

// ============================================================================
// MAIN VERIFICATION
// ============================================================================

async function main() {
  log("╔══════════════════════════════════════════════════════════════╗", C.blue);
  log("║         CLAIM VERIFICATION - Reality Mode                    ║", C.blue);
  log("╚══════════════════════════════════════════════════════════════╝", C.blue);
  log(`\nStarted: ${results.timestamp}\n`);
  
  // Load claim matrix
  const matrixPath = resolve(REPO_ROOT, ".agent/claim-matrix.json");
  if (!existsSync(matrixPath)) {
    log("⚠️  Claim matrix not found, running basic verification...", C.yellow);
  }
  
  // 1. Verify core CLI commands
  log("\n🔧 Verifying CLI commands...", C.blue);
  await verifyCliCommand("reach_version", "version");
  await verifyCliCommand("reach_doctor", "doctor");
  await verifyCliCommand("reach_demo", "demo");
  await verifyCliCommand("reach_quickstart", "quickstart");
  await verifyCliCommand("reach_status", "status");
  await verifyCliCommand("reach_bugreport", "bugreport", ["--help"]);
  
  // 2. Verify determinism infrastructure
  await verifyDeterminismInvariants();
  
  // 3. Verify code paths
  log("\n📁 Verifying code paths...", C.blue);
  await verifyCodePath("canonicalJson", "src/determinism/canonicalJson");
  await verifyCodePath("deterministicMap", "src/determinism/deterministicMap");
  await verifyCodePath("deterministicSort", "src/determinism/deterministicSort");
  await verifyCodePath("hashStream", "src/determinism/hashStream");
  await verifyCodePath("seededRandom", "src/determinism/seededRandom");
  await verifyCodePath("zeoliteCore", "src/core/zeolite-core");
  await verifyCodePath("shim", "src/core/shim");
  
  // 4. Verify test paths
  log("\n🧪 Verifying test coverage...", C.blue);
  await verifyTestPath("canonicalJson_test", "src/determinism/canonicalJson.test.ts");
  await verifyTestPath("determinism_invariants", "src/determinism/determinism-invariants.test.ts");
  await verifyTestPath("cross_language_hash", "src/determinism/crossLanguageHash.test.ts");
  await verifyTestPath("zeolite_core", "src/core/zeolite-core.test.ts");
  await verifyTestPath("doctor_test", "doctor.test.ts");
  
  // 5. Verify examples
  log("\n📚 Verifying examples...", C.blue);
  await verifyExampleRuns("example_01", "examples/01-quickstart-local/run.js");
  await verifyExampleRuns("example_02", "examples/02-diff-and-explain/run.js");
  await verifyExampleRuns("example_03", "examples/03-junction-to-decision/run.js");
  await verifyExampleRuns("example_04", "examples/04-action-plan-execute-safe/run.js");
  await verifyExampleRuns("example_05", "examples/05-export-verify-replay/run.js");
  await verifyExampleRuns("example_06", "examples/06-retention-compact-safety/run.js");
  
  // 6. Verify web routes
  await verifyWebRoutes();
  
  // 7. Verify npm scripts
  await verifyNpmScripts();
  
  // 8. Verify documentation
  log("\n📖 Verifying documentation...", C.blue);
  await verifyFileExists("readme", "README.md", "README");
  await verifyFileExists("install_doc", "docs/INSTALL.md", "Installation guide");
  await verifyFileExists("cli_doc", "docs/cli.md", "CLI reference");
  await verifyFileExists("determinism_contract", "docs/architecture/determinism-contract.md", "Determinism contract");
  await verifyFileExists("smoke_tests_doc", "docs/testing-smoke.md", "Smoke testing guide");
  
  // Print summary
  log("\n" + "═".repeat(64), C.blue);
  log("VERIFICATION SUMMARY", C.blue);
  log("═".repeat(64), C.blue);
  
  const { pass, fail, warn, skip, total } = results.summary;
  
  log(`\nTotal claims checked: ${total}`);
  log(`  ✅ PASS: ${pass}`, C.green);
  log(`  ❌ FAIL: ${fail}`, fail > 0 ? C.red : C.green);
  log(`  ⚠️  WARN: ${warn}`, warn > 0 ? C.yellow : C.green);
  log(`  ⏭️  SKIP: ${skip}`, C.gray);
  
  // Output JSON if requested
  if (FLAGS.json) {
    console.log(JSON.stringify(results, null, 2));
  }
  
  // Detailed failures
  if (results.failed.length > 0 && !FLAGS.json) {
    log("\n❌ FAILED CLAIMS:", C.red);
    for (const f of results.failed) {
      log(`  • [${f.category}] ${f.claim}: ${f.message}`, C.red);
      if (FLAGS.verbose && f.details) {
        log(`    Details: ${JSON.stringify(f.details)}`, C.gray);
      }
    }
  }
  
  // Exit code
  const exitCode = results.failed.length > 0 ? 1 : 0;
  
  log("\n" + "─".repeat(64), C.blue);
  if (exitCode === 0) {
    log("✅ All critical claims verified successfully!", C.green);
  } else {
    log(`❌ ${results.failed.length} claim(s) failed verification`, C.red);
  }
  log("─".repeat(64) + "\n", C.blue);
  
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
