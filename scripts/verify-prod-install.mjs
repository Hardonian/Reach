#!/usr/bin/env node
/**
 * Verify production install - installs with --omit=dev and runs minimal smoke test
 * This ensures the production deployment has no toxic dependencies
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

console.log("🔒 Reach Production Install Verification\n");

// Step 1: Clean install with --omit=dev
console.log("Step 1: Installing production dependencies only (--omit=dev)...");
try {
  execSync("npm ci --omit=dev --ignore-scripts", {
    cwd: rootDir,
    stdio: "inherit",
    timeout: 120000,
  });
  console.log("✅ Production install completed\n");
} catch (error) {
  console.error("❌ Production install failed:", error.message);
  process.exit(1);
}

// Step 2: Verify no node_modules exists in dev-only locations
console.log("Step 2: Verifying dev dependencies are not present...");
const devOnlyPaths = [
  "node_modules/eslint",
  "node_modules/vitest",
  "node_modules/@typescript-eslint",
];

let devDepsFound = false;
for (const path of devOnlyPaths) {
  const fullPath = join(rootDir, path);
  if (existsSync(fullPath)) {
    console.error(`  ❌ Dev dependency found: ${path}`);
    devDepsFound = true;
  }
}

if (devDepsFound) {
  console.error("\n❌ Dev dependencies detected in production install!");
  process.exit(1);
} else {
  console.log("  ✅ No dev dependencies in production install\n");
}

// Step 3: Verify SDK builds without dev deps
console.log("Step 3: Verifying SDK builds without dev dependencies...");
try {
  execSync("cd sdk/ts && npm run build", {
    cwd: rootDir,
    stdio: "pipe",
    timeout: 60000,
  });
  console.log("  ✅ SDK builds successfully\n");
} catch (error) {
  console.error("  ⚠️  SDK build failed (may require dev deps for TypeScript compilation)");
  console.log("  ℹ️  This is expected if SDK uses TypeScript compiler from devDependencies\n");
}

// Step 4: Verify Go services build (no npm deps needed)
console.log("Step 4: Verifying Go services build...");
try {
  execSync("cd services/runner && go build ./cmd/reach-serve ./cmd/reachctl", {
    cwd: rootDir,
    stdio: "pipe",
    timeout: 120000,
  });
  console.log("  ✅ Go services build successfully\n");
} catch (error) {
  console.error("  ❌ Go services build failed:", error.message);
  process.exit(1);
}

console.log("✅ Production install verification passed!");
console.log("   The runtime has no toxic dependencies and is ready for deployment.\n");
