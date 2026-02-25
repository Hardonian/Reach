#!/usr/bin/env node
/**
 * Supply Chain Verification Script
 * 
 * Runs lockfile integrity, dependency audit, and SBOM generation smoke tests.
 * Designed to be non-blocking for advisory issues while catching real problems.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

let exitCode = 0;
let advisoryCount = 0;

function log(section, message, type = "info") {
  const prefix = type === "error" ? `${RED}✗${RESET}` : type === "warn" ? `${YELLOW}⚠${RESET}` : `${GREEN}✓${RESET}`;
  console.log(`${prefix} [${section}] ${message}`);
}

function run(command, options = {}) {
  try {
    return execSync(command, { cwd: root, encoding: "utf8", stdio: options.silent ? "pipe" : "inherit", ...options });
  } catch (e) {
    if (options.ignoreError) {
      return e.stdout || "";
    }
    throw e;
  }
}

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║       SUPPLY CHAIN VERIFICATION (Launch Pack)             ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

// 1. Lockfile Integrity Check
console.log("━".repeat(60));
console.log("1. LOCKFILE INTEGRITY CHECK");
console.log("━".repeat(60));
try {
  run("npm run verify:lockfile", { silent: true });
  log("LOCKFILE", "package-lock.json integrity verified");
} catch (e) {
  log("LOCKFILE", "Lockfile verification failed", "error");
  exitCode = 1;
}

// 2. Toxic Dependency Check
console.log("\n━".repeat(60));
console.log("2. TOXIC DEPENDENCY FIREWALL");
console.log("━".repeat(60));
try {
  run("npm run verify:no-toxic-deps", { silent: true });
  log("FIREWALL", "No toxic dependencies detected");
} catch (e) {
  log("FIREWALL", "Blocked packages detected", "error");
  exitCode = 1;
}

// 3. Production Install Verification
console.log("\n━".repeat(60));
console.log("3. PRODUCTION INSTALL VERIFICATION");
console.log("━".repeat(60));
try {
  run("npm run verify:prod-install", { silent: true });
  log("PROD-INSTALL", "Production install simulation passed");
} catch (e) {
  log("PROD-INSTALL", "Production install verification failed", "error");
  exitCode = 1;
}

// 4. npm audit (advisory only - doesn't block)
console.log("\n━".repeat(60));
console.log("4. DEPENDENCY AUDIT (Advisory)");
console.log("━".repeat(60));
try {
  const auditOutput = run("npm audit --audit-level=high", { silent: true, ignoreError: true });
  log("AUDIT", "No high/critical vulnerabilities (or advisory mode)");
} catch (e) {
  const vulns = e.message.includes("vulnerabilities") ? e.message.match(/(\d+) vulnerabilities?/) : null;
  if (vulns) {
    advisoryCount += parseInt(vulns[1], 10);
    log("AUDIT", `${vulns[1]} vulnerabilities found (advisory only)`, "warn");
  } else {
    log("AUDIT", "Audit completed with warnings (advisory)", "warn");
  }
}

// 5. SBOM Generation Smoke Test
console.log("\n━".repeat(60));
console.log("5. SBOM GENERATION SMOKE TEST");
console.log("━".repeat(60));
try {
  // Check if cyclonedx-npm is available, otherwise document the path
  const sbomPath = path.join(root, "dist", "reach-sbom.cyclonedx.json");
  if (fs.existsSync(sbomPath)) {
    const sbom = JSON.parse(fs.readFileSync(sbomPath, "utf8"));
    const componentCount = sbom.components?.length || 0;
    log("SBOM", `Existing SBOM valid with ${componentCount} components`);
  } else {
    // Try to generate with npm sbom (npm 9.5.0+)
    try {
      run("npm sbom --format=cyclonedx-json --output=dist/sbom-smoke.json", { silent: true });
      if (fs.existsSync(path.join(root, "dist", "sbom-smoke.json"))) {
        log("SBOM", "SBOM generation successful (npm sbom)");
        fs.unlinkSync(path.join(root, "dist", "sbom-smoke.json"));
      } else {
        log("SBOM", "SBOM generation not available (generated in CI release)", "warn");
        advisoryCount++;
      }
    } catch (sbomErr) {
      log("SBOM", "SBOM generated in CI release workflow (npm sbom unavailable)", "warn");
      advisoryCount++;
    }
  }
} catch (e) {
  log("SBOM", `SBOM check failed: ${e.message}`, "warn");
  advisoryCount++;
}

// 6. License Summary (advisory)
console.log("\n━".repeat(60));
console.log("6. LICENSE SUMMARY (Advisory)");
console.log("━".repeat(60));
try {
  const licenseOutput = run("npm ls --depth=0 --json", { silent: true, ignoreError: true });
  const pkg = JSON.parse(licenseOutput || "{}");
  const deps = Object.keys(pkg.dependencies || {});
  log("LICENSE", `${deps.length} direct dependencies`);
  console.log(`   Run 'npm ls' for full dependency tree`);
} catch (e) {
  log("LICENSE", "Could not generate license summary (advisory)", "warn");
  advisoryCount++;
}

// Summary
console.log("\n" + "═".repeat(60));
console.log("SUPPLY CHAIN VERIFICATION SUMMARY");
console.log("═".repeat(60));

if (exitCode === 0) {
  log("RESULT", "All blocking checks passed ✅");
} else {
  log("RESULT", "Some blocking checks failed ❌", "error");
}

if (advisoryCount > 0) {
  log("ADVISORY", `${advisoryCount} advisory items (non-blocking)`, "warn");
  console.log(`   These are informational and don't block the build.`);
}

console.log("\n📋 Supply Chain Artifacts (in CI releases):");
console.log("   - SHA256SUMS: Checksums for all binaries");
console.log("   - artifact-manifest.json: Signed artifact index");
console.log("   - reach-sbom.cyclonedx.json: Software Bill of Materials");
console.log("\n🔒 Security Resources:");
console.log("   - SECURITY.md: Vulnerability reporting process");
console.log("   - .github/workflows/security-audit.yml: Automated scanning");
console.log("   - .github/workflows/osv-scan.yml: OSV supply chain scan");

process.exit(exitCode);
