#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const checks = [
  {
    file: "apps/arcade/src/app/layout.tsx",
    mustContain: [
      "metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? \"https://reach.dev\")",
      "url: process.env.NEXT_PUBLIC_BASE_URL ?? \"https://reach.dev\"",
    ],
  },
  {
    file: "apps/arcade/src/app/sitemap.ts",
    mustContain: ["const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? \"https://reach.dev\";"],
  },
  {
    file: "apps/docs/app/layout.tsx",
    mustContain: [
      "metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? \"https://reach-cli.com\")",
    ],
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(ROOT, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: file not found`);
    continue;
  }
  const content = fs.readFileSync(fullPath, "utf8");
  for (const required of check.mustContain) {
    if (!content.includes(required)) {
      failures.push(`${check.file}: missing "${required}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("❌ verify:canonical-urls failed");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("✅ verify:canonical-urls passed");

