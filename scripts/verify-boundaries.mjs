#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const exts = new Set([".ts", ".tsx", ".js", ".mjs"]);
const skipDirs = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage", "target"]);

function walk(dir, output = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, output);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) continue;
    output.push(full);
  }
  return output;
}

function toRel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function extractSpecifiers(content) {
  const specs = [];
  const patterns = [
    /import\s+[^"']*from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function isEnterpriseFile(relPath) {
  return (
    relPath.includes("/enterprise/") ||
    relPath.startsWith("apps/arcade/src/lib/enterprise/") ||
    relPath.startsWith("apps/arcade/src/app/api/v1/governance/enterprise/")
  );
}

function isMarketingFile(relPath) {
  return relPath.startsWith("apps/docs/");
}

function isArcadeFile(relPath) {
  return relPath.startsWith("apps/arcade/");
}

function runBaseBoundaryScript() {
  try {
    execSync("node scripts/validate-import-boundaries.js", { stdio: "inherit" });
  } catch {
    process.exit(1);
  }
}

function main() {
  runBaseBoundaryScript();

  const files = walk(root);
  const violations = [];

  for (const file of files) {
    const rel = toRel(file);
    const content = fs.readFileSync(file, "utf8");
    const specs = extractSpecifiers(content);

    for (const spec of specs) {
      const normalized = spec.replace(/\\/g, "/");

      // OSS / Enterprise boundary: only enterprise surfaces may import enterprise modules.
      if (
        normalized.includes("/lib/enterprise") ||
        normalized.includes("@/lib/enterprise") ||
        normalized.includes("packages/enterprise")
      ) {
        if (!isEnterpriseFile(rel)) {
          violations.push(
            `[OSS↔Enterprise] ${rel} imports enterprise module "${normalized}" outside enterprise boundary`,
          );
        }
      }

      // Marketing/docs must never import app internals from arcade.
      if (isMarketingFile(rel)) {
        if (
          normalized.includes("apps/arcade/") ||
          normalized.includes("../arcade/") ||
          normalized.includes("../../arcade/") ||
          normalized.includes("../../../arcade/") ||
          normalized.includes("@/app/api/") ||
          normalized.includes("@/lib/db/") ||
          normalized.includes("@/lib/cloud-") ||
          normalized.includes("@/lib/enterprise/")
        ) {
          violations.push(
            `[Marketing Boundary] ${rel} imports arcade internals via "${normalized}"`,
          );
        }
      }

      // App/console must not import marketing app internals from docs.
      if (isArcadeFile(rel)) {
        if (
          normalized.includes("apps/docs/") ||
          normalized.includes("../docs/") ||
          normalized.includes("../../docs/") ||
          normalized.includes("../../../docs/")
        ) {
          violations.push(`[App↔Marketing] ${rel} imports docs internals via "${normalized}"`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("❌ verify:boundaries failed");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log("✅ verify:boundaries passed");
}

main();
