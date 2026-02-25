#!/usr/bin/env node
/**
 * Pre-install hook to check Node.js version compatibility
 * Use --strict to fail locally and in CI.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json manually to avoid import assertion issues
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const version = packageJson.engines.node;
const currentVersion = process.version;

const strict = process.argv.includes("--strict");
const tokens = version.split(/\s+/).filter(Boolean);
const minToken = tokens.find((token) => token.startsWith(">=")) ?? ">=0.0.0";
const maxToken = tokens.find((token) => token.startsWith("<"));

const parseMajorMinor = (input) => {
  const clean = input.replace(/^v/, "").replace(/^[<>]=?/, "");
  const [majorRaw = "0", minorRaw = "0"] = clean.split(".");
  return {
    major: Number.parseInt(majorRaw, 10),
    minor: Number.parseInt(minorRaw, 10),
  };
};

const current = parseMajorMinor(currentVersion);
const min = parseMajorMinor(minToken);
const max = maxToken ? parseMajorMinor(maxToken) : null;

const meetsMin =
  current.major > min.major || (current.major === min.major && current.minor >= min.minor);
const belowMax =
  !max || current.major < max.major || (current.major === max.major && current.minor < max.minor);
const isSupported = meetsMin && belowMax;

console.log(`Node.js version check: ${currentVersion} (required: ${version})`);

if (!isSupported) {
  console.error(`\n❌ Unsupported Node.js version: ${currentVersion}`);
  console.error(`   Required: Node.js ${version}`);
  console.error("   Recommended fix:");
  console.error("   - nvm use (or install) the version from .nvmrc");
  console.error("   - or run: npm run toolchain:node20 -- <npm-command>\n");

  if (strict || process.env.CI) {
    process.exit(1);
  } else {
    console.warn("⚠️  Continuing anyway (not in CI environment)...\n");
  }
} else {
  console.log(`✅ Node.js version ${currentVersion} is supported\n`);
}
