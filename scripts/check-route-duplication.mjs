/**
 * Route Duplication Prevention
 *
 * Ensures:
 *   1. Only one page.tsx exists per canonical domain route
 *   2. Console nav items don't contain duplicates
 *   3. Known route aliases (e.g., /marketplace vs /marketplace-alt) are explicitly allowed
 *
 * Usage: node scripts/check-route-duplication.mjs
 * Exit: 0 = clean, 1 = duplicates found
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appDir = path.join(repoRoot, "apps/arcade/src/app");

// ── Canonical domains: only one page allowed per domain ──────────────

const CANONICAL_DOMAINS = [
  "console",
  "console/agents",
  "console/runners",
  "console/evaluation",
  "console/governance",
  "console/datasets",
  "console/cost",
  "console/ecosystem",
  "console/integrations",
  "console/artifacts",
  "console/alerts",
  "console/traces",
  "architecture",
  "transparency",
  "marketplace",
];

// Known aliases that are allowed (won't trigger duplication warning)
const ALLOWED_ALIASES = new Set([
  "marketplace-alt", // Stitch marketplace variant — explicitly allowed
]);

let errors = 0;

// ── Check 1: One page.tsx per canonical domain ───────────────────────

console.log("Check 1: One page per canonical domain\n");
for (const domain of CANONICAL_DOMAINS) {
  const dir = path.join(appDir, domain);
  const pagePath = path.join(dir, "page.tsx");
  if (!fs.existsSync(pagePath)) {
    console.error(`  MISSING: ${domain}/page.tsx — canonical route has no page`);
    errors++;
  } else {
    console.log(`  OK: ${domain}/page.tsx`);
  }
}

// ── Check 2: No surprise duplicates outside canonical set ────────────

console.log("\nCheck 2: No unexpected route duplicates\n");

function findPageFiles(dir, prefix = "") {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "api") continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findPageFiles(fullPath, relPath));
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      results.push(prefix || "/");
    }
  }
  return results;
}

const allRoutes = findPageFiles(appDir);
const domainRoots = new Map();

for (const route of allRoutes) {
  // Extract the top-level domain (e.g., "marketplace" from "marketplace-alt")
  const rootDomain = route.split("/")[0];
  if (!domainRoots.has(rootDomain)) {
    domainRoots.set(rootDomain, []);
  }
  domainRoots.get(rootDomain).push(route);
}

// Look for domain roots that have similar names (possible duplicates)
const routeNames = allRoutes.map(r => r.split("/")[0]);
const seen = new Set();
for (const name of routeNames) {
  if (seen.has(name)) continue;
  seen.add(name);

  // Check for near-duplicates (e.g., "marketplace" and "marketplace-alt")
  for (const other of seen) {
    if (other === name) continue;
    if (other.startsWith(name + "-") || name.startsWith(other + "-")) {
      if (!ALLOWED_ALIASES.has(name) && !ALLOWED_ALIASES.has(other)) {
        console.error(`  DUPLICATE?: "${name}" and "${other}" look like route duplicates`);
        console.error(`    If intentional, add to ALLOWED_ALIASES in check-route-duplication.mjs`);
        errors++;
      } else {
        console.log(`  OK (allowed alias): ${name} / ${other}`);
      }
    }
  }
}

// ── Check 3: Console nav doesn't have duplicate hrefs ────────────────

console.log("\nCheck 3: Console nav has no duplicate hrefs\n");
const consoleLayoutPath = path.join(repoRoot, "apps/arcade/src/components/stitch/console/ConsoleLayout.tsx");
if (fs.existsSync(consoleLayoutPath)) {
  const content = fs.readFileSync(consoleLayoutPath, "utf-8");
  const hrefMatches = [...content.matchAll(/href:\s*(?:ROUTES\.\w+(?:\.\w+)*|['"]([^'"]+)['"])/g)];
  const hrefs = hrefMatches.map(m => m[0]);
  const hrefSet = new Set();
  for (const href of hrefs) {
    if (hrefSet.has(href)) {
      console.error(`  DUPLICATE NAV: ${href} appears multiple times in ConsoleLayout`);
      errors++;
    }
    hrefSet.add(href);
  }
  if (errors === 0) {
    console.log(`  OK: ${hrefs.length} nav items, no duplicates`);
  }
} else {
  console.log("  SKIP: ConsoleLayout.tsx not found");
}

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n--- Route duplication check: ${errors === 0 ? "PASSED" : `FAILED (${errors} issue(s))`} ---`);
process.exit(errors > 0 ? 1 : 0);
