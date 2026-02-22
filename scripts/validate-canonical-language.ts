#!/usr/bin/env npx tsx
/**
 * Canonical Language Enforcement Script
 *
 * Scans presentation/UI layers for internal terminology that should not
 * be exposed to end users. Internal terms like "node", "DAG", "edge",
 * "graph traversal", etc. are valid in domain/infrastructure code but
 * must not leak into user-facing surfaces.
 *
 * Usage:
 *   npx tsx scripts/enforce-canonical-language.ts
 *
 * Exit codes:
 *   0 — No violations found
 *   1 — Terminology drift detected
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuration ──────────────────────────────────────────────────────

/** Directories considered "presentation / UI layer". */
const UI_LAYER_GLOBS: string[] = [
  "apps/arcade/src/components",
  "apps/arcade/src/app",
  "extensions/vscode/src",
];

/** File extensions to scan in UI layers. */
const SCAN_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".html"]);

/** Files/directories to skip even inside UI layers. */
const SKIP_PATTERNS = [
  "node_modules",
  ".next",
  "dist",
  "__tests__",
  ".test.",
  ".spec.",
  "test-utils",
];

/**
 * Paths (relative to repo root) where specific terms are exempted.
 * Developer documentation explaining protocols may use protocol names.
 */
const TERM_EXEMPTIONS: Record<string, string[]> = {
  "MCP (raw protocol name)": [
    "apps/arcade/src/app/docs/mcp",
    "apps/arcade/src/app/docs/architecture",
    "apps/arcade/src/app/docs/engine",
    "apps/arcade/src/app/docs/errors",
    "apps/arcade/src/app/docs/execution",
    "apps/arcade/src/app/docs/getting-started",
    "apps/arcade/src/app/docs/page.tsx",
    "apps/arcade/src/app/docs/skills",
    "apps/arcade/src/app/faq",
    "apps/arcade/src/app/skills",
  ],
  "edge (graph)": [
    "apps/arcade/src/app/docs/execution",
    "apps/arcade/src/app/docs/architecture",
    "apps/arcade/src/app/docs/engine",
  ],
};

/**
 * Internal terms that must NOT appear in user-facing text.
 * Each entry is { term, pattern, description }.
 * `pattern` is a RegExp that matches the term in a user-facing context,
 * excluding import statements, type annotations, and comments.
 */
interface ForbiddenTerm {
  term: string;
  pattern: RegExp;
  description: string;
}

const FORBIDDEN_TERMS: ForbiddenTerm[] = [
  {
    term: "DAG",
    pattern: /\bDAG\b/,
    description: "Use 'workflow' or 'execution plan' instead of 'DAG'",
  },
  {
    term: "node (graph)",
    pattern: /(?:graph|execution)\s*node|node\s*(?:execution|result)/i,
    description:
      "Use 'step' or 'stage' instead of 'node' in workflow context",
  },
  {
    term: "edge (graph)",
    pattern: /\bedge(?:s)?\b.*(?:graph|node|connect)/i,
    description: "Use 'connection' or 'dependency' instead of 'edge'",
  },
  {
    term: "graph traversal",
    pattern: /graph\s*traversal/i,
    description: "Use 'workflow execution' instead of 'graph traversal'",
  },
  {
    term: "topological sort",
    pattern: /topological\s*sort/i,
    description:
      "Use 'execution ordering' instead of 'topological sort'",
  },
  {
    term: "adjacency",
    pattern: /\badjacency\b/i,
    description: "Use 'dependencies' instead of 'adjacency'",
  },
  {
    term: "vertex",
    pattern: /\bvertex\b|\bvertices\b/i,
    description: "Use 'step' instead of 'vertex/vertices'",
  },
  {
    term: "in-degree / out-degree",
    pattern: /\b(?:in|out)-?degree\b/i,
    description: "Avoid exposing graph theory terms in UI",
  },
  {
    term: "cycle detection",
    pattern: /cycle\s*detect/i,
    description:
      "Use 'circular dependency check' instead of 'cycle detection'",
  },
  {
    term: "MCP (raw protocol name)",
    pattern: /\bMCP\b(?!\s*(?:server|client|Server|Client))/,
    description: "Use 'tool integration' instead of raw 'MCP' in UI text",
  },
  {
    term: "POEE",
    pattern: /\bPOEE\b/,
    description:
      "Use 'execution proof' or 'audit trail' instead of 'POEE'",
  },
  {
    term: "CID (content ID)",
    pattern: /\bCID\b/,
    description:
      "Use 'pack identifier' or 'content hash' instead of 'CID'",
  },
];

// ── Allowlist File ────────────────────────────────────────────────────

interface AllowlistEntry {
  filePath: string; // relative to repo root
  lineNumber?: number; // optional — if omitted, whole file is allowed for that term
  term: string;
}

function loadAllowlist(repoRoot: string): AllowlistEntry[] {
  const allowlistPath = path.join(repoRoot, "scripts", "canonical-language.allowlist.txt");
  if (!fs.existsSync(allowlistPath)) return [];

  const entries: AllowlistEntry[] = [];
  const lines = fs.readFileSync(allowlistPath, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // Format: <path>:<line> <term>  OR  <path> <term>
    const colonMatch = line.match(/^(.+?):(\d+)\s+(.+)$/);
    if (colonMatch) {
      entries.push({ filePath: colonMatch[1], lineNumber: parseInt(colonMatch[2], 10), term: colonMatch[3] });
      continue;
    }
    const spaceMatch = line.match(/^(\S+)\s+(.+)$/);
    if (spaceMatch) {
      entries.push({ filePath: spaceMatch[1], term: spaceMatch[2] });
    }
  }
  return entries;
}

function isAllowlisted(
  allowlist: AllowlistEntry[],
  filePath: string,
  lineNumber: number,
  term: string,
  repoRoot: string,
): boolean {
  const rel = path.relative(repoRoot, filePath);
  return allowlist.some((entry) => {
    if (entry.term !== term) return false;
    if (!rel.startsWith(entry.filePath)) return false;
    if (entry.lineNumber !== undefined && entry.lineNumber !== lineNumber) return false;
    return true;
  });
}

// ── Scanning Logic ─────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  term: string;
  description: string;
  snippet: string;
}

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((pat) => filePath.includes(pat));
}

function isLineExempt(line: string, prevLine?: string): boolean {
  const trimmed = line.trim();
  // Inline escape hatch: previous line has `// canonical-language: allow`
  if (prevLine && prevLine.trim() === "// canonical-language: allow") return true;
  // Skip import/require statements
  if (/^import\s/.test(trimmed) || /require\(/.test(trimmed)) return true;
  // Skip type-only lines (interfaces, type aliases)
  if (/^(?:export\s+)?(?:type|interface)\s/.test(trimmed)) return true;
  // Skip single-line comments that are code documentation, not user-facing text
  if (/^\/\//.test(trimmed)) return true;
  // Skip lines that are purely JSX attribute bindings with no visible text
  if (/^\w+=\{/.test(trimmed) && !/"[^"]*"/.test(trimmed)) return true;
  return false;
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (shouldSkip(full)) continue;
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function isTermExempt(term: string, filePath: string, repoRoot: string): boolean {
  const exemptions = TERM_EXEMPTIONS[term];
  if (!exemptions) return false;
  // Normalize to forward slashes for cross-platform comparison.
  const rel = path.relative(repoRoot, filePath).replace(/\\/g, "/");
  return exemptions.some((ex) => rel.startsWith(ex));
}

function scanFile(filePath: string, repoRoot: string, allowlist: AllowlistEntry[]): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : undefined;
    if (isLineExempt(line, prevLine)) continue;

    for (const forbidden of FORBIDDEN_TERMS) {
      if (isTermExempt(forbidden.term, filePath, repoRoot)) continue;
      if (isAllowlisted(allowlist, filePath, i + 1, forbidden.term, repoRoot)) continue;
      if (forbidden.pattern.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          term: forbidden.term,
          description: forbidden.description,
          snippet: line.trim().substring(0, 120),
        });
      }
    }
  }

  return violations;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const repoRoot = path.resolve(__dirname, "..");
  const allowlist = loadAllowlist(repoRoot);
  const allViolations: Violation[] = [];

  for (const glob of UI_LAYER_GLOBS) {
    const dir = path.join(repoRoot, glob);
    const files = collectFiles(dir);
    for (const file of files) {
      allViolations.push(...scanFile(file, repoRoot, allowlist));
    }
  }

  if (allViolations.length === 0) {
    console.log("validate:language — PASSED (0 terminology violations)");
    process.exit(0);
  }

  console.error(
    `validate:language — FAILED (${allViolations.length} violation(s) found)\n`
  );

  for (const v of allViolations) {
    const rel = path.relative(repoRoot, v.file);
    console.error(`  ${rel}:${v.line}`);
    console.error(`    Term: ${v.term}`);
    console.error(`    Fix:  ${v.description}`);
    console.error(`    Line: ${v.snippet}`);
    console.error("");
  }

  console.error(
    "Internal terms must not appear in presentation/UI layers."
  );
  console.error(
    "Fix the above violations or add exemptions to enforce-canonical-language.ts."
  );
  process.exit(1);
}

main();
