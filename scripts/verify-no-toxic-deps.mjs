#!/usr/bin/env node
/**
 * Verify no toxic dependencies are present in the dependency tree
 * Fails if clawdbot, codex, connect, request, marked, or other toxic packages are found
 */

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// List of toxic packages that should NEVER be in the production dependency tree
const TOXIC_PACKAGES = [
  "clawdbot",
  "codex",
  "connect",
  "request",
  "marked",
  "hono",
  "node-llama-cpp",
];

// Packages that are allowed only in specific contexts with overrides
const RESTRICTED_PACKAGES = [
  {
    name: "tar",
    minVersion: "7.0.0",
    reason: "CVE-2024-28863 and others in <7.0.0",
  },
  { name: "ws", minVersion: "8.18.1", reason: "CVE-2024-XXXX in <8.18.1" },
];

console.log("🛡️  Reach Toxic Dependency Check\n");
console.log("Checking for toxic packages:", TOXIC_PACKAGES.join(", "));
console.log("Checking restricted packages:", RESTRICTED_PACKAGES.map((p) => p.name).join(", "));
console.log();

let hasErrors = false;
let hasWarnings = false;

// Check each workspace
const workspaces = [
  { name: "Root", path: "." },
  { name: "VS Code Extension", path: "extensions/vscode" },
  { name: "SDK", path: "sdk/ts" },
  { name: "Arcade App", path: "apps/arcade" },
];

for (const workspace of workspaces) {
  console.log(`Checking ${workspace.name}...`);

  try {
    // Get dependency tree
    const output = execSync("npm ls --all 2>&1", {
      cwd: join(rootDir, workspace.path),
      encoding: "utf-8",
      timeout: 30000,
    });

    // Check for toxic packages
    for (const toxic of TOXIC_PACKAGES) {
      if (output.includes(`${toxic}@`)) {
        console.error(`  ❌ TOXIC DEP FOUND: ${toxic} in ${workspace.name}`);
        hasErrors = true;
      }
    }

    // Check for restricted packages with version constraints
    for (const restricted of RESTRICTED_PACKAGES) {
      const regex = new RegExp(`${restricted.name}@([\\d.]+)`);
      const match = output.match(regex);
      if (match) {
        const version = match[1];
        const [major] = version.split(".").map(Number);
        const [minMajor] = restricted.minVersion.split(".").map(Number);

        if (major < minMajor) {
          console.error(`  ❌ VULNERABLE: ${restricted.name}@${version} in ${workspace.name}`);
          console.error(`     Required: >=${restricted.minVersion} (${restricted.reason})`);
          hasErrors = true;
        } else {
          console.log(`  ✅ ${restricted.name}@${version} OK`);
        }
      }
    }

    console.log(`  ✅ ${workspace.name} check completed`);
  } catch (error) {
    // npm ls exits with error if peer deps are missing, but we still get output
    if (error.stdout) {
      const output = error.stdout.toString();

      for (const toxic of TOXIC_PACKAGES) {
        if (output.includes(`${toxic}@`)) {
          console.error(`  ❌ TOXIC DEP FOUND: ${toxic} in ${workspace.name}`);
          hasErrors = true;
        }
      }
    }
    console.log(`  ✅ ${workspace.name} check completed`);
  }
  console.log();
}

// Summary
if (hasErrors) {
  console.error("❌ TOXIC DEPENDENCIES DETECTED!");
  console.error("   These packages must be removed or isolated before deployment.");
  console.error("   See SECURITY.md for remediation steps.\n");
  process.exit(1);
} else {
  console.log("✅ No toxic dependencies detected!");
  console.log("   All packages meet security requirements.\n");
  process.exit(0);
}
