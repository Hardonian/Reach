#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "tools", "guard-structure.ps1");

function extractAllowList(source, variableName) {
  const blockRegex = new RegExp(`\\$${variableName}\\s*=\\s*@\\(([^]*?)\\)`, "m");
  const blockMatch = source.match(blockRegex);
  if (!blockMatch?.[1]) {
    throw new Error(`Could not parse ${variableName} in ${sourcePath}`);
  }

  const values = [];
  const itemRegex = /"([^"]+)"/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(blockMatch[1])) !== null) {
    values.push(itemMatch[1]);
  }
  return new Set(values);
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ lint:structure failed: missing ${sourcePath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(sourcePath, "utf8");
  const allowedFiles = extractAllowList(source, "AllowedFiles");
  const allowedDirs = extractAllowList(source, "AllowedDirs");

  let hasEntropy = false;
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  for (const entry of entries) {
    const name = entry.name;
    if (entry.isDirectory()) {
      if (!allowedDirs.has(name)) {
        console.error(`Entropy Detected: Unexpected directory found in root: ${name}`);
        hasEntropy = true;
      }
      continue;
    }

    if (!allowedFiles.has(name)) {
      console.error(`Entropy Detected: Unexpected file found in root: ${name}`);
      hasEntropy = true;
    }
  }

  if (hasEntropy) {
    console.error("🚨 Structural violation detected. Maintain normalized structure.");
    process.exit(1);
  }

  console.log("✅ Structural integrity maintained.");
}

main();
