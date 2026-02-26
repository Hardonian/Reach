/**
 * Determinism Static Scanner — Phase A
 *
 * Scans the entire repository for nondeterministic patterns and produces
 * a machine-readable determinism audit report.
 *
 * Usage:
 *   npx tsx scripts/scan-determinism.ts [repoRoot] [outputDir] [--json] [--ci]
 *
 * Flags:
 *   --json   Print JSON to stdout in addition to writing files
 *   --ci     Fail with exit code 1 if any CRITICAL findings in proof-hash paths
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface Pattern {
  id: string;
  regex: RegExp;
  risk: "CRITICAL" | "MEDIUM" | "LOW";
  description: string;
  remedy: string;
}

const TS_PATTERNS: Pattern[] = [
  {
    id: "DATE_NOW",
    regex: /\bDate\.now\(\)/g,
    risk: "CRITICAL",
    description: "Date.now() produces nondeterministic timestamps",
    remedy:
      "Accept timestamp as a parameter or use src/determinism/seededRandom.ts",
  },
  {
    id: "MATH_RANDOM",
    regex: /\bMath\.random\(\)/g,
    risk: "CRITICAL",
    description: "Math.random() is nondeterministic",
    remedy: "Use seededRandom() from src/determinism/seededRandom.ts",
  },
  {
    id: "OBJECT_KEYS_UNSORTED",
    regex: /Object\.keys\s*\([^)]+\)(?!\s*\.sort\s*\()/g,
    risk: "MEDIUM",
    description:
      "Object.keys() without .sort() has undefined iteration order in hashing paths",
    remedy:
      "Use Object.keys(x).sort() or canonicalJson() from src/determinism/canonicalJson.ts",
  },
  {
    id: "JSON_STRINGIFY_NON_CANONICAL",
    regex:
      /JSON\.stringify\s*\([^)]+\)(?!\s*(?:\/\/\s*canonical|;\s*\/\/\s*canonical|toCanonicalJson))/g,
    risk: "CRITICAL",
    description:
      "JSON.stringify without canonicalization produces unstable key ordering - CRITICAL in fingerprint paths",
    remedy: "Use toCanonicalJson() from src/engine/translate for all fingerprint-contributing serialization",
    paths: ["src/engine", "src/determinism", "services/runner/internal/determinism", "services/runner/internal/poee"],
  },
  {
    id: "LOCALE_FORMAT",
    regex:
      /\.toLocaleDateString\s*\(|\.toLocaleTimeString\s*\(|\.toLocaleString\s*\(/g,
    risk: "MEDIUM",
    description:
      "Locale-sensitive formatting varies across environments and platforms",
    remedy: "Use .toISOString() or fixed-locale Intl.DateTimeFormat",
  },
  {
    id: "PROCESS_ENV_IMPLICIT",
    regex:
      /process\.env(?:\[["'`][^"'`]+["'`]\]|\.[A-Z_]+)(?!\s*(?:\?\?|!==|===|==|&&|\|\|)\s*["'`])/g,
    risk: "LOW",
    description:
      "Implicit environment reads may vary across machines without validation",
    remedy:
      "Validate env vars at startup; document required vars in .env.example",
  },
];

const GO_PATTERNS: Pattern[] = [
  {
    id: "TIME_NOW",
    regex: /\btime\.Now\s*\(\)/g,
    risk: "CRITICAL",
    description:
      "time.Now() in fingerprint-contributing paths breaks determinism",
    remedy: "Pass time as a parameter or use a fixed epoch anchor",
  },
  {
    id: "RAND_UNSEED",
    regex: /\brand\s*\.\s*(?:Int|Float|Intn|Int63|Read|Shuffle)\s*\(/g,
    risk: "CRITICAL",
    description: "math/rand without explicit seeding is nondeterministic",
    remedy:
      "Remove from proof-contributing paths or use a deterministic seed derived from inputs",
  },
  {
    id: "UUID_V4",
    regex:
      /uuid\s*\.\s*(?:New|NewString|NewRandom|MustParse)\s*\(\s*\)/g,
    risk: "CRITICAL",
    description: "UUID v4 generation is nondeterministic",
    remedy: "Derive IDs deterministically from content hash",
  },
  {
    id: "MAP_ITERATION_UNSORTED",
    regex: /for\s+\w+(?:\s*,\s*\w+)?\s*:=\s*range\s+(\w+)\s*\{/g,
    risk: "MEDIUM",
    description:
      "Go map iteration order is randomized by the runtime — sort keys first",
    remedy:
      "Extract keys, sort.Strings(keys), then iterate. See determinism.CanonicalJSON",
  },
  {
    id: "JSON_MARSHAL_MAP",
    regex: /json\.Marshal\s*\(\s*(?:map\[|&?[a-z]\w*)\s*/g,
    risk: "LOW",
    description:
      "json.Marshal on maps may produce unstable ordering across Go versions",
    remedy:
      "Use determinism.CanonicalJSON() for proof-contributing serialization",
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  id: string;
  file: string;
  line: number;
  column: number;
  snippet: string;
  risk: "CRITICAL" | "MEDIUM" | "LOW";
  description: string;
  remedy: string;
  affectsProofHash: boolean;
}

interface AuditReport {
  generated_at: string;
  repo_root: string;
  scan_id: string;
  summary: {
    total_files_scanned: number;
    total_findings: number;
    critical: number;
    medium: number;
    low: number;
    proof_hash_risks: number;
  };
  findings: Finding[];
}

// ---------------------------------------------------------------------------
// Proof-hash-critical paths — nondeterminism here directly corrupts proofs
// ---------------------------------------------------------------------------

const PROOF_HASH_PATHS = [
  "services/runner/internal/determinism",
  "services/runner/internal/poee",
  "services/runner/cmd/reachctl",
  "core/evaluation",
  "src/determinism",
];

// Directories and extensions to skip
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
  "vendor",
  "third_party",
]);

const SKIP_EXTENSIONS = new Set([
  ".exe", ".zip", ".png", ".mp4", ".ico", ".woff", ".woff2",
  ".ttf", ".otf", ".eot", ".svg", ".jpg", ".jpeg", ".gif",
  ".webp", ".avif", ".pdf", ".bin", ".db", ".sqlite",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isProofHashPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return PROOF_HASH_PATHS.some((p) => normalized.includes(p));
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".");
}

function shouldSkipFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SKIP_EXTENSIONS.has(ext);
}

function walkDir(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        files.push(...walkDir(fullPath, extensions));
      }
    } else if (
      extensions.some((ext) => entry.name.endsWith(ext)) &&
      !shouldSkipFile(fullPath)
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function scanFile(filePath: string, patterns: Pattern[]): Finding[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.split("\n");
  const findings: Finding[] = [];
  const isProof = isProofHashPath(filePath);

  for (const pattern of patterns) {
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const trimmed = line.trim();

      // Skip pure comment lines
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("#") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
      ) {
        continue;
      }

      // Inline-comment check: skip if line contains suppression marker
      if (line.includes("// determinism:ok") || line.includes("// nondeterministic:ok")) {
        continue;
      }

      const lineRegex = new RegExp(pattern.regex.source, "g");
      let match: RegExpExecArray | null;

      while ((match = lineRegex.exec(line)) !== null) {
        findings.push({
          id: pattern.id,
          file: filePath.replace(/\\/g, "/"),
          line: lineIdx + 1,
          column: match.index + 1,
          snippet: trimmed.substring(0, 120),
          risk: pattern.risk,
          description: pattern.description,
          remedy: pattern.remedy,
          affectsProofHash: isProof,
        });
      }
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(repoRoot: string): AuditReport {
  const findings: Finding[] = [];
  let totalFiles = 0;

  // Scan TypeScript / JavaScript
  const tsFiles = walkDir(repoRoot, [".ts", ".tsx", ".js", ".mjs"]);
  for (const file of tsFiles) {
    findings.push(...scanFile(file, TS_PATTERNS));
    totalFiles++;
  }

  // Scan Go
  const goFiles = walkDir(repoRoot, [".go"]);
  for (const file of goFiles) {
    findings.push(...scanFile(file, GO_PATTERNS));
    totalFiles++;
  }

  // Sort: CRITICAL first, then by file path
  const riskOrder: Record<string, number> = { CRITICAL: 0, MEDIUM: 1, LOW: 2 };
  findings.sort((a, b) => {
    const rDiff = riskOrder[a.risk] - riskOrder[b.risk];
    if (rDiff !== 0) return rDiff;
    return a.file.localeCompare(b.file);
  });

  const critical = findings.filter((f) => f.risk === "CRITICAL").length;
  const medium = findings.filter((f) => f.risk === "MEDIUM").length;
  const low = findings.filter((f) => f.risk === "LOW").length;
  const proofHashRisks = findings.filter(
    (f) => f.affectsProofHash && f.risk === "CRITICAL"
  ).length;

  // Stable scan ID derived from findings (deterministic)
  const scanId = crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        findings.map((f) => `${f.file}:${f.line}:${f.id}`).sort()
      )
    )
    .digest("hex")
    .substring(0, 16);

  return {
    generated_at: "0000-00-00T00:00:00Z", // Epoch anchor — deterministic placeholder
    repo_root: repoRoot,
    scan_id: scanId,
    summary: {
      total_files_scanned: totalFiles,
      total_findings: findings.length,
      critical,
      medium,
      low,
      proof_hash_risks: proofHashRisks,
    },
    findings,
  };
}

function generateMarkdown(report: AuditReport): string {
  const lines: string[] = [
    "# Determinism Audit Report",
    "",
    `**Scan ID:** \`${report.scan_id}\``,
    "",
    "## Summary",
    "",
    "| Severity | Count |",
    "|----------|-------|",
    `| 🔴 CRITICAL | ${report.summary.critical} |`,
    `| 🟡 MEDIUM | ${report.summary.medium} |`,
    `| 🟢 LOW | ${report.summary.low} |`,
    `| **Total** | **${report.summary.total_findings}** |`,
    "",
    `**Files Scanned:** ${report.summary.total_files_scanned}`,
    `**Proof Hash Risks (CRITICAL in engine paths):** ${report.summary.proof_hash_risks}`,
    "",
  ];

  if (report.summary.critical > 0) {
    lines.push("## 🔴 Critical Findings");
    lines.push("");
    lines.push(
      "These findings may directly compromise proof hash stability. Fix before merging."
    );
    lines.push("");
    const critical = report.findings.filter((f) => f.risk === "CRITICAL");
    for (const f of critical) {
      lines.push(`### \`${f.id}\` — \`${f.file}:${f.line}\``);
      lines.push("");
      lines.push(`**Description:** ${f.description}`);
      lines.push("");
      lines.push(`**Snippet:**`);
      lines.push("```");
      lines.push(f.snippet);
      lines.push("```");
      lines.push(`**Remedy:** ${f.remedy}`);
      lines.push(`**Affects Proof Hash:** ${f.affectsProofHash ? "⚠️ Yes" : "No"}`);
      lines.push("");
    }
  }

  if (report.summary.medium > 0) {
    lines.push("## 🟡 Medium Findings");
    lines.push("");
    const medium = report.findings.filter((f) => f.risk === "MEDIUM");
    for (const f of medium) {
      lines.push(`### \`${f.id}\` — \`${f.file}:${f.line}\``);
      lines.push(`**Description:** ${f.description}`);
      lines.push(`**Remedy:** ${f.remedy}`);
      lines.push("");
    }
  }

  if (report.summary.low > 0) {
    lines.push("## 🟢 Low Findings");
    lines.push("");
    const low = report.findings.filter((f) => f.risk === "LOW");
    for (const f of low) {
      lines.push(
        `- \`${f.id}\` at \`${f.file}:${f.line}\`: ${f.description}`
      );
    }
    lines.push("");
  }

  lines.push("## Remediation Priority");
  lines.push("");
  lines.push(
    "1. **CRITICAL in engine paths** — Fix `DATE_NOW`, `MATH_RANDOM`, `TIME_NOW`, `UUID_V4` in `services/runner/internal/` and `core/`"
  );
  lines.push(
    "2. **Unsorted iteration** — Replace `Object.keys()` without `.sort()` in any serialization path"
  );
  lines.push(
    "3. **MEDIUM in metadata paths** — Audit `JSON_STRINGIFY_NON_CANONICAL` in report/audit code"
  );
  lines.push(
    "4. **LOW** — Document acceptable environment reads with `// determinism:ok` suppression"
  );
  lines.push("");
  lines.push("## Suppression");
  lines.push("");
  lines.push(
    "To suppress a known-acceptable finding, add `// determinism:ok` on the same line:"
  );
  lines.push("```typescript");
  lines.push("const ts = Date.now(); // determinism:ok — used only for logging");
  lines.push("```");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const repoRoot = path.resolve(
  args.find((a) => !a.startsWith("--")) ?? "."
);
const jsonOutput = args.includes("--json");
const ciMode = args.includes("--ci");
// Second positional arg is output dir
const positional = args.filter((a) => !a.startsWith("--"));
const outputDir = positional[1] ? path.resolve(positional[1]) : repoRoot;

const report = generateReport(repoRoot);

const jsonPath = path.join(outputDir, "determinism-report.json");
const mdPath = path.join(outputDir, "determinism-report.md");

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
fs.writeFileSync(mdPath, generateMarkdown(report));

if (jsonOutput) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log("Determinism Audit Scan");
  console.log("======================");
  console.log(`Scan ID:           ${report.scan_id}`);
  console.log(`Files scanned:     ${report.summary.total_files_scanned}`);
  console.log(`Critical:          ${report.summary.critical}`);
  console.log(`Medium:            ${report.summary.medium}`);
  console.log(`Low:               ${report.summary.low}`);
  console.log(`Proof hash risks:  ${report.summary.proof_hash_risks}`);
  console.log(`Report JSON:       ${jsonPath}`);
  console.log(`Report Markdown:   ${mdPath}`);
}

if (ciMode && report.summary.proof_hash_risks > 0) {
  process.stderr.write(
    `\n❌ CI FAILED: ${report.summary.proof_hash_risks} CRITICAL nondeterminism issue(s) in proof-hash paths. Fix before merging.\n`
  );
  process.exit(1);
}
