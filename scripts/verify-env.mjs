#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const ENV_TS_PATH = path.join(REPO_ROOT, "apps/arcade/src/lib/env.ts");
const ENV_EXAMPLE_PATH = path.join(REPO_ROOT, ".env.example");

console.log("🛡️  Reach Environment Consistency Check\n");

if (!fs.existsSync(ENV_TS_PATH)) {
  console.error(`❌ Missing env.ts at ${ENV_TS_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
  console.error(`❌ Missing .env.example at ${ENV_EXAMPLE_PATH}`);
  process.exit(1);
}

const envTsContent = fs.readFileSync(ENV_TS_PATH, "utf8");
const envExampleContent = fs.readFileSync(ENV_EXAMPLE_PATH, "utf8");

// Simple regex to find keys in Zod object
// Matches keys followed by a colon and z. something
const keysInTs = [...envTsContent.matchAll(/^\s+([A-Z0-9_]+):/gm)].map((m) => m[1]);
const processEnvKeys = new Set();

try {
  const trackedArcadeFiles = execSync("git ls-files apps/arcade/src", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));

  for (const relativeFile of trackedArcadeFiles) {
    const absoluteFile = path.join(REPO_ROOT, relativeFile);
    if (!fs.existsSync(absoluteFile)) continue;
    const content = fs.readFileSync(absoluteFile, "utf8");
    for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      processEnvKeys.add(match[1]);
    }
  }
} catch (error) {
  console.warn(`⚠️  Unable to scan process.env usage: ${String(error)}`);
}

const allKeys = Array.from(new Set([...keysInTs, ...processEnvKeys])).sort();

console.log(`Checking ${allKeys.length} environment keys from env.ts + process.env usage...\n`);

let missingKeys = [];
for (const key of allKeys) {
  // Check if key exists in .env.example (either as KEY= or # KEY=)
  const regex = new RegExp(`^#?\\s*${key}=`, "m");
  if (!regex.test(envExampleContent)) {
    missingKeys.push(key);
  }
}

if (missingKeys.length > 0) {
  console.error("❌ Missing keys in .env.example:");
  missingKeys.forEach((k) => console.error(`   - ${k}`));
  console.error("\nConsistency check failed. Please update .env.example with the missing keys.");
  process.exit(1);
} else {
  console.log("✅ All environment keys are documented in .env.example.");
  process.exit(0);
}
