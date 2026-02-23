#!/usr/bin/env node
/**
 * scripts/validate-import-boundaries.js
 *
 * Enforces architectural import boundaries for the Reach project.
 * Uses only Node.js built-in modules (fs, path, url).
 *
 * Exit codes:
 *   0  — No violations found
 *   1  — One or more violations found
 *
 * Flags:
 *   --fix   Print remediation suggestions alongside each violation (no auto-fix)
 *
 * Rules enforced:
 *   R1 — crates/**, core/**, services/runner/** MUST NOT import cloud or billing
 *   R2 — apps/cli/**, services/runner/cmd/** MUST NOT import web/frontend modules
 *   R3 — apps/arcade/** MUST NOT import from engine source internals
 *
 * See docs/IMPORT_BOUNDARY_RULES.md for the full specification.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── ANSI colour helpers ──────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

/** Wrap `text` with the given ANSI codes, then reset. */
function fmt(text, ...codes) {
  return codes.join("") + String(text) + C.reset;
}

// ─── Global configuration ─────────────────────────────────────────────────────

/** Absolute path to the repository root (one directory above this script). */
const REPO_ROOT = path.resolve(__dirname, "..");

/** Whether remediation suggestions should be printed after each violation. */
const FIX_MODE = process.argv.includes("--fix");

/** Directory names to skip unconditionally when walking the file tree. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "target",
  "dist",
  "build",
  ".turbo",
  "coverage",
  ".cache",
  "__pycache__",
  "vendor",
  ".pnp",
]);

/** File extensions considered as source files to be analysed. */
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".mjs", ".go", ".rs"]);

// ─── Boundary rules ───────────────────────────────────────────────────────────

/**
 * @typedef {{ pattern: string, label: string }} ForbiddenPattern
 * @typedef {{
 *   id:              string,
 *   name:            string,
 *   description:     string,
 *   sourcePrefixes:  string[],
 *   forbiddenPatterns: ForbiddenPattern[],
 *   fix:             string,
 * }} Rule
 */

/** @type {Rule[]} */
const RULES = [
  {
    id: "R1",
    name: "Core cannot import cloud",
    description: "crates/**, core/**, services/runner/** MUST NOT import cloud or billing modules",
    // Forward-slash path prefixes relative to the repo root.
    sourcePrefixes: ["crates/", "core/", "services/runner/"],
    forbiddenPatterns: [
      { pattern: "apps/arcade/lib/cloud", label: "apps/arcade/lib/cloud*" },
      { pattern: "apps/arcade/lib/stripe", label: "apps/arcade/lib/stripe*" },
      { pattern: "apps/arcade/lib/redis", label: "apps/arcade/lib/redis*" },
      { pattern: "services/billing", label: "services/billing/**" },
    ],
    fix: [
      "Extract shared types to core/features (Resolution Pattern A).",
      "        Replace billing-tier references with configuration-flag-based feature gating.",
      "        Cloud access must go through adapter interfaces — never a direct import.",
      "        See docs/IMPORT_BOUNDARY_RULES.md §7 for resolution patterns.",
    ].join("\n"),
  },
  {
    id: "R2",
    name: "CLI cannot import web",
    description: "apps/cli/**, services/runner/cmd/** MUST NOT import web or frontend modules",
    sourcePrefixes: ["apps/cli/", "services/runner/cmd/"],
    forbiddenPatterns: [
      { pattern: "apps/arcade", label: "apps/arcade/**" },
      { pattern: "apps/web", label: "apps/web/**" },
      { pattern: "apps/mobile", label: "apps/mobile/**" },
    ],
    fix: [
      "CLI tools must remain headless and browser-free.",
      "        Communicate with web services via HTTP APIs, not direct imports.",
      "        See docs/IMPORT_BOUNDARY_RULES.md Rule 2.",
    ].join("\n"),
  },
  {
    id: "R3",
    name: "Web cannot mutate engine directly",
    description: "apps/arcade/** MUST NOT import from engine source internals",
    sourcePrefixes: ["apps/arcade/"],
    forbiddenPatterns: [
      { pattern: "crates/engine/src", label: "crates/engine/src/**" },
      { pattern: "core/evaluation", label: "core/evaluation/**" },
    ],
    fix: [
      "Use SDK clients (sdk/ts/) or HTTP APIs to interact with the engine.",
      "        Engine state must be managed by the engine, never by the UI layer.",
      "        See docs/IMPORT_BOUNDARY_RULES.md Rule 3.",
    ].join("\n"),
  },
];

/**
 * Grandfathered violations discovered during the initial repo audit.
 * These are NOT permanently silenced — they are tracked open issues.
 * The set key format is: "<forward-slash-relative-path>::<forbidden-pattern>"
 *
 * Violations here still appear in the report but are labelled [GRANDFATHERED]
 * and do not cause a non-zero exit code so that CI continues to pass until
 * the owning team ships the fix.
 */
const GRANDFATHERED = new Set([
  // Audit V1 — capsule-sync imports services/billing/tier
  // Owner: platform team  Fix milestone: v0.4
  // Ref: docs/IMPORT_BOUNDARY_RULES.md Violation V1
  "services/capsule-sync/internal/api/server.go::services/billing",
]);

// ─── Import extractors ────────────────────────────────────────────────────────

/**
 * @typedef {{ specifier: string, line: number }} ImportRef
 */

/**
 * Extract imported module specifiers from a TypeScript / JavaScript file.
 * Handles:
 *   - Static ES imports:          import X from '…'
 *   - Side-effect imports:        import '…'
 *   - Re-exports:                 export * from '…' / export { X } from '…'
 *   - Dynamic imports:            import('…')
 *   - CommonJS require:           require('…')
 *
 * @param {string} content
 * @returns {ImportRef[]}
 */
function extractTSImports(content) {
  const results = [];
  const lines = content.split("\n");

  // Static: import|export … from 'specifier'
  const STATIC_FROM_RE = /^\s*(?:import|export)\b[^'"]*from\s+['"]([^'"]+)['"]/;
  // Side-effect: import 'specifier'
  const SIDE_EFFECT_RE = /^\s*import\s+['"]([^'"]+)['"]/;
  // Dynamic and require (may appear anywhere on the line)
  const DYNAMIC_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimStart();
    const lineNum = i + 1;

    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    let m;

    if ((m = STATIC_FROM_RE.exec(raw))) {
      results.push({ specifier: m[1], line: lineNum });
    } else if ((m = SIDE_EFFECT_RE.exec(raw))) {
      results.push({ specifier: m[1], line: lineNum });
    }

    DYNAMIC_RE.lastIndex = 0;
    while ((m = DYNAMIC_RE.exec(raw)) !== null) {
      results.push({ specifier: m[1], line: lineNum });
    }

    REQUIRE_RE.lastIndex = 0;
    while ((m = REQUIRE_RE.exec(raw)) !== null) {
      results.push({ specifier: m[1], line: lineNum });
    }
  }

  return results;
}

/**
 * Extract imported package paths from a Go source file.
 * Handles single-line imports and parenthesised import blocks, optionally
 * with package aliases.
 *
 * @param {string} content
 * @returns {ImportRef[]}
 */
function extractGoImports(content) {
  const results = [];
  const lines = content.split("\n");

  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;

    if (trimmed.startsWith("//")) continue;

    let m;

    // Single-line: import "path"  or  import alias "path"
    if (!inBlock && (m = /^import\s+(?:\w+\s+)?"([^"]+)"/.exec(trimmed))) {
      results.push({ specifier: m[1], line: lineNum });
      continue;
    }

    // Begin import block: import (
    if (!inBlock && /^import\s*\(/.test(trimmed)) {
      inBlock = true;
      continue;
    }

    // End import block
    if (inBlock && trimmed === ")") {
      inBlock = false;
      continue;
    }

    // Inside import block — captures: "path"  or  alias "path"
    if (inBlock && (m = /"([^"]+)"/.exec(trimmed))) {
      results.push({ specifier: m[1], line: lineNum });
    }
  }

  return results;
}

/**
 * Extract import-like references from a Rust (.rs) source file.
 * Captures the top-level path root from:
 *   use foo::bar::Baz  →  "foo/bar/Baz"  (:: → /)
 *   extern crate foo   →  "foo"
 *
 * Note: `mod` declarations are not import references and are therefore
 * excluded to avoid false-positives on internal module layout.
 *
 * @param {string} content
 * @returns {ImportRef[]}
 */
function extractRustImports(content) {
  const results = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;

    if (trimmed.startsWith("//") || trimmed.startsWith("#!")) continue;

    let m;

    // use path::to::Item  |  pub use path::to::Item
    if ((m = /^(?:pub\s+)?use\s+([\w]+(?:::\S+)*)/.exec(trimmed))) {
      // Normalise :: to / and strip { } * so the string is path-comparable
      const normalised = m[1].replace(/::/g, "/").replace(/[{}*\s]/g, "");
      results.push({ specifier: normalised, line: lineNum });
      continue;
    }

    // extern crate name
    if ((m = /^extern\s+crate\s+(\w+)/.exec(trimmed))) {
      results.push({ specifier: m[1], line: lineNum });
    }
  }

  return results;
}

/**
 * Extract dependency crate names from a Cargo.toml file.
 * Looks inside [dependencies], [dev-dependencies], and [build-dependencies]
 * sections.
 *
 * @param {string} content
 * @returns {ImportRef[]}
 */
function extractCargoTomlDeps(content) {
  const results = [];
  const lines = content.split("\n");
  let inDepsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNum = i + 1;

    // Section header
    if (trimmed.startsWith("[")) {
      inDepsSection =
        trimmed === "[dependencies]" ||
        trimmed.startsWith("[dependencies.") ||
        trimmed === "[dev-dependencies]" ||
        trimmed.startsWith("[dev-dependencies.") ||
        trimmed === "[build-dependencies]" ||
        trimmed.startsWith("[build-dependencies.");
      continue;
    }

    if (!inDepsSection || !trimmed || trimmed.startsWith("#")) continue;

    // dep-name = "version"  or  dep-name = { … }  or  dep-name.feature = …
    const m = /^([\w-]+)\s*[.=]/.exec(trimmed);
    if (m) results.push({ specifier: m[1], line: lineNum });
  }

  return results;
}

// ─── File walker ──────────────────────────────────────────────────────────────

/**
 * Recursively yield the absolute path of every analysable source file under
 * `dir`, skipping SKIP_DIRS and non-source files.
 *
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walkDir(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTS.has(ext) || entry.name === "Cargo.toml") {
        yield fullPath;
      }
    }
  }
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

/**
 * Return the forward-slash path of `fullPath` relative to REPO_ROOT.
 * This is the canonical form used throughout the rule engine.
 *
 * @param {string} fullPath
 * @returns {string}
 */
function toRelFwd(fullPath) {
  return path.relative(REPO_ROOT, fullPath).replace(/\\/g, "/");
}

/**
 * Return true if this specific (file, pattern) combination is grandfathered.
 *
 * @param {string} relPath
 * @param {string} pattern
 */
function isGrandfathered(relPath, pattern) {
  return GRANDFATHERED.has(`${relPath}::${pattern}`);
}

/**
 * @typedef {{
 *   file:        string,
 *   line:        number,
 *   specifier:   string,
 *   ruleId:      string,
 *   ruleName:    string,
 *   label:       string,
 *   fix:         string,
 *   grandfathered: boolean,
 * }} Violation
 */

/**
 * Analyse a single source file against all applicable boundary rules.
 *
 * @param {string} fullPath
 * @returns {Violation[]}
 */
function checkFile(fullPath) {
  const relPath = toRelFwd(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const isCargoToml = path.basename(fullPath) === "Cargo.toml";

  // Determine which rules are applicable to this file's location
  const applicable = RULES.filter((r) =>
    r.sourcePrefixes.some((prefix) => relPath.startsWith(prefix)),
  );
  if (applicable.length === 0) return [];

  let content;
  try {
    content = fs.readFileSync(fullPath, "utf8");
  } catch {
    return [];
  }

  // Choose the right extractor
  let refs = /** @type {ImportRef[]} */ ([]);
  if (ext === ".go") {
    refs = extractGoImports(content);
  } else if (ext === ".rs") {
    refs = extractRustImports(content);
  } else if (isCargoToml) {
    refs = extractCargoTomlDeps(content);
  } else {
    // .ts .tsx .js .mjs
    refs = extractTSImports(content);
  }

  const violations = /** @type {Violation[]} */ ([]);

  for (const rule of applicable) {
    for (const { specifier, line } of refs) {
      for (const fp of rule.forbiddenPatterns) {
        if (!specifier.includes(fp.pattern)) continue;

        violations.push({
          file: relPath,
          line,
          specifier,
          ruleId: rule.id,
          ruleName: rule.name,
          label: fp.label,
          fix: rule.fix,
          grandfathered: isGrandfathered(relPath, fp.pattern),
        });
      }
    }
  }

  return violations;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function main() {
  const t0 = Date.now();

  console.log(fmt("\n  Reach — Import Boundary Validation", C.bold, C.cyan));
  console.log(fmt(`  Repo root : ${REPO_ROOT}`, C.gray));
  if (FIX_MODE) {
    console.log(fmt("  Mode      : --fix  (suggestions only — no auto-fix)", C.yellow));
  }
  console.log("");

  const allViolations = /** @type {Violation[]} */ ([]);
  let filesScanned = 0;

  for (const filePath of walkDir(REPO_ROOT)) {
    filesScanned++;
    const vs = checkFile(filePath);
    if (vs.length > 0) allViolations.push(...vs);
  }

  const elapsed = Date.now() - t0;
  const blocking = allViolations.filter((v) => !v.grandfathered);
  const grandfathered = allViolations.filter((v) => v.grandfathered);

  // ── Clean ──────────────────────────────────────────────────────────────────
  if (allViolations.length === 0) {
    console.log(fmt("  ✓  All import boundaries are clean.", C.bold, C.green));
    console.log(fmt(`  Scanned ${filesScanned} files in ${elapsed}ms.`, C.gray));
    console.log("");
    process.exit(0);
  }

  // ── Group by rule id ───────────────────────────────────────────────────────
  const byRule = /** @type {Record<string, Violation[]>} */ ({});
  for (const v of allViolations) {
    (byRule[v.ruleId] ??= []).push(v);
  }

  for (const ruleId of Object.keys(byRule).sort()) {
    const rule = RULES.find((r) => r.id === ruleId);
    const violations = byRule[ruleId];

    console.log(fmt(`  ✗  [${ruleId}] ${rule.name}`, C.bold, C.red));
    console.log(fmt(`     ${rule.description}`, C.gray));
    console.log("");

    for (const v of violations) {
      const gfTag = v.grandfathered ? fmt(" [GRANDFATHERED — tracked open issue]", C.yellow) : "";

      console.log(fmt(`    ${v.file}`, C.bold) + fmt(`:${v.line}`, C.yellow) + gfTag);
      console.log(fmt("      import  : ", C.gray) + fmt(`"${v.specifier}"`, C.red));
      console.log(fmt("      matches : ", C.gray) + fmt(v.label, C.yellow));

      if (FIX_MODE) {
        console.log(fmt("      fix     : ", C.gray) + v.fix);
      }
      console.log("");
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (grandfathered.length > 0) {
    console.log(
      fmt(
        `  ⚠  ${grandfathered.length} grandfathered violation(s) — tracked but not blocking.`,
        C.yellow,
      ),
    );
  }

  if (blocking.length === 0) {
    // Only grandfathered violations — still pass CI
    console.log(
      fmt(
        `  ✓  No new violations. Scanned ${filesScanned} files in ${elapsed}ms.`,
        C.bold,
        C.green,
      ),
    );
    if (!FIX_MODE) {
      console.log(
        fmt("  Re-run with --fix for remediation suggestions on tracked violations.", C.gray),
      );
    }
    console.log("");
    process.exit(0);
  }

  const plural = blocking.length === 1 ? "violation" : "violations";
  console.log(
    fmt(
      `  Found ${blocking.length} blocking import boundary ${plural} across ${filesScanned} files (${elapsed}ms).`,
      C.bold,
      C.red,
    ),
  );
  if (!FIX_MODE) {
    console.log(fmt("  Re-run with --fix for remediation suggestions.", C.gray));
  }
  console.log(
    fmt(
      "\n  ✗  BLOCKED — import boundary violations must be resolved before merge.\n",
      C.bold,
      C.red,
    ),
  );
  process.exit(1);
}

main();
