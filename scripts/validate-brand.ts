/**
 * validate-brand.ts
 *
 * CI script: scan presentation-layer files for residual "Reach" brand text.
 * Fails with exit code 1 if any disallowed occurrences are found.
 *
 * Run via:  npm run validate:brand
 *
 * Rollback override: if NEXT_PUBLIC_BRAND_NAME=Reach is set, the expected
 * brand name changes to "Reach" and this script passes for that name.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname_compat = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname_compat, "..");

/**
 * Presentation-layer paths to scan (relative to REPO_ROOT).
 * Only user-visible files are included.
 */
const PRESENTATION_PATHS = ["apps/arcade/src/app", "apps/arcade/src/components", "README.md"];

/**
 * Patterns that are permitted to contain "Reach" because they are
 * internal identifiers, not presentation text.
 *
 * Lines matching any of these patterns will be ignored.
 */
const ALLOWED_PATTERNS: RegExp[] = [
  // CLI commands (lowercase reach)
  /\breach\s+(doctor|wizard|run|operator|share|proof|auth|webhooks|version|federation|studio|dashboard|account|packs|cluster)\b/i,
  // ENV variable names (all-caps REACH)
  /REACH_[A-Z_]+/,
  // localStorage / cookie identifiers
  /reach_tenant_id|reach_session/,
  // URL domains
  /reach\.dev|reach\.io|api\.reach|get\.reach/,
  // File paths
  /~\/\.reach|\.\/reach\.|reach\.yaml|reach-cloud\.db|reach_sk_/,
  // Docker image names
  /reach\/runner/,
  // Git URLs
  /Hardonian\/Reach\.git|github\.com.*reach\.git/i,
  // HTTP header name
  /Reach-Token/,
  // Internal tool names in code comments
  /\/\/ .*Reach Runner Service/,
  // Process identifiers
  /pkill.*reach/,
  // Shell navigation to repo dir
  /\b(cd|ls|mkdir)\s+Reach\b/i,
  // Reach binary or directory reference
  /\.\/Reach\b|\/Reach\./i,
  // reachctl (internal CLI binary)
  /reachctl/i,
  // "reaching" / "reached" / "reachable" (English verbs, not brand)
  /\b(reaching|reached|reachable|unreachable)\b/i,
  // Email addresses
  /@reach\.(dev|io)/,
  // Already correctly using ReadyLayer
  /ReadyLayer/,
];

function isAllowed(line: string): boolean {
  return ALLOWED_PATTERNS.some((p) => p.test(line));
}

function scanFile(filePath: string): { file: string; line: number; text: string }[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: { file: string; line: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    // Case-sensitive match for "Reach" as brand name
    if (/\bReach\b/.test(lineText) && !isAllowed(lineText)) {
      violations.push({
        file: path.relative(REPO_ROOT, filePath),
        line: i + 1,
        text: lineText.trim(),
      });
    }
  }

  return violations;
}

function collectFiles(targetPath: string): string[] {
  const absPath = path.join(REPO_ROOT, targetPath);
  if (!fs.existsSync(absPath)) return [];

  const stat = fs.statSync(absPath);
  if (stat.isFile()) return [absPath];

  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const s = fs.statSync(full);
      if (s.isDirectory()) {
        if (entry === "node_modules" || entry === ".git") continue;
        walk(full);
      } else if (/\.(tsx?|jsx?|md)$/.test(entry)) {
        results.push(full);
      }
    }
  };
  walk(absPath);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const expectedBrand = process.env.NEXT_PUBLIC_BRAND_NAME ?? "ReadyLayer";

if (expectedBrand === "Reach") {
  console.log("validate:brand — SKIP: rollback mode active (NEXT_PUBLIC_BRAND_NAME=Reach)");
  process.exit(0);
}

const allFiles: string[] = [];
for (const p of PRESENTATION_PATHS) {
  allFiles.push(...collectFiles(p));
}

const allViolations: { file: string; line: number; text: string }[] = [];

for (const f of allFiles) {
  allViolations.push(...scanFile(f));
}

if (allViolations.length === 0) {
  console.log(
    `validate:brand — PASS: no residual "Reach" brand text found in ${allFiles.length} scanned files.`,
  );
  process.exit(0);
} else {
  console.error(
    `validate:brand — FAIL: found ${allViolations.length} residual "Reach" occurrence(s):\n`,
  );
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.text}`);
  }
  console.error(
    '\nFix: replace visible "Reach" text with "ReadyLayer", or add an allowance in scripts/validate-brand.ts if it is an internal identifier.',
  );
  process.exit(1);
}
