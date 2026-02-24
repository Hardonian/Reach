import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import type { DglReport, DglViolation } from "./types.js";
import { diffAstExports } from "./ast-diff.js";
import { diffApiContract } from "./api-contract-diff.js";
import { compareOpenApi, discoverOpenApiSpecs } from "./openapi-compat.js";

const TRUST_BOUNDARY = ["auth", "tenant", "secret", "webhook", "payment", "raw body"];
const SCHEMA_VERSION = "1.1.0";
const TOOL_VERSION = "0.4.0";

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: "utf-8" }).trim();
}

function gitShow(sha: string, filePath: string): string {
  try {
    execSync(`git cat-file -e ${sha}:${filePath}`, { stdio: "ignore" });
    return git(`show ${sha}:${filePath}`);
  } catch {
    return "";
  }
}

function readJson<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

export function computeIntentFingerprint(manifestPath: string): string {
  const content = fs.readFileSync(manifestPath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

function semanticViolations(baseSha: string, headSha: string, filePath: string): DglViolation[] {
  const baseText = gitShow(baseSha, filePath);
  const headText = gitShow(headSha, filePath);
  if (!baseText || !headText) return [];
  const astEligible = /\.(ts|tsx|js|jsx)$/.test(filePath);
  const apiEligible = filePath.includes("schema") || filePath.endsWith(".json") || filePath.includes("/api/");
  return [
    ...(astEligible ? diffAstExports(filePath, baseText, headText) : []),
    ...(apiEligible ? diffApiContract(filePath, baseText, headText) : []),
  ];
}

function changedFiles(baseSha: string, headSha: string, changedOnly: boolean): string[] {
  if (!changedOnly) return git("ls-files").split("\n").filter(Boolean);
  try {
    return git(`diff --name-only ${baseSha} ${headSha}`).split("\n").filter(Boolean);
  } catch {
    return git("ls-files").split("\n").filter(Boolean);
  }
}

function cacheKey(baseSha: string, headSha: string, files: string[]): string {
  const configHash = createHash("sha256")
    .update(fs.existsSync(path.join(process.cwd(), "config/dgl-openapi.json")) ? fs.readFileSync(path.join(process.cwd(), "config/dgl-openapi.json"), "utf-8") : "")
    .digest("hex");
  const contentHash = createHash("sha256").update(files.join("|")).digest("hex");
  return createHash("sha256").update([baseSha, headSha, contentHash, configHash, SCHEMA_VERSION, TOOL_VERSION].join("::")).digest("hex");
}

function pruneCache(dir: string): void {
  const entries = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => path.join(dir, f)) : [];
  const maxEntries = 40;
  if (entries.length <= maxEntries) return;
  const sorted = entries
    .map((p) => ({ p, t: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.t - a.t)
    .slice(maxEntries);
  for (const e of sorted) fs.rmSync(e.p, { force: true });
}

export function scanDgl(baseSha: string, headSha: string, changedOnly = true): DglReport {
  const repo = path.basename(process.cwd());
  const timings = { language_scan: 0, intent: 0, openapi: 0, semantic: 0, trust_boundary: 0, report_write: 0 };
  const files = changedFiles(baseSha, headSha, changedOnly);
  const cacheDir = path.join(process.cwd(), ".cache", "dgl");
  fs.mkdirSync(cacheDir, { recursive: true });
  pruneCache(cacheDir);
  const key = cacheKey(baseSha, headSha, files);
  const cacheFile = path.join(cacheDir, `${key}.json`);
  if (fs.existsSync(cacheFile)) {
    return readJson(cacheFile, {} as DglReport);
  }

  const violations: DglViolation[] = [];
  const langStart = Date.now();
  timings.language_scan = Date.now() - langStart;

  const trustStart = Date.now();
  for (const f of files) {
    const lower = f.toLowerCase();
    if (TRUST_BOUNDARY.some((k) => lower.includes(k))) {
      violations.push({ type: "trust_boundary", severity: "error", paths: [f], evidence: "Changed file intersects trust-boundary keyword set.", suggested_fix: "Add targeted tests and acknowledgement under dgl/intent-acknowledgements/.", line: 1 });
    }
    if (f.includes("package.json") || f.includes("go.mod") || f.includes("Cargo.toml")) {
      violations.push({ type: "dependency_graph", severity: "warn", paths: [f], evidence: "Dependency declaration changed.", suggested_fix: "Review high-risk deps (auth/network/crypto/telemetry) before merge.", line: 1 });
    }
  }
  timings.trust_boundary = Date.now() - trustStart;

  const semStart = Date.now();
  for (const f of files) {
    violations.push(...semanticViolations(baseSha, headSha, f));
  }
  timings.semantic = Date.now() - semStart;

  const intentStart = Date.now();
  const manifest = path.join(process.cwd(), "docs/architecture/intent-manifest.json");
  if (fs.existsSync(manifest)) {
    const fingerprint = computeIntentFingerprint(manifest);
    const branch = git("rev-parse --abbrev-ref HEAD").replace(/\//g, "_");
    const baselinePath = path.join(process.cwd(), "dgl/baselines/intent", `${branch}.json`);
    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as { fingerprint: string };
      if (baseline.fingerprint !== fingerprint) {
        violations.push({ type: "intent", severity: "error", paths: ["docs/architecture/intent-manifest.json"], evidence: `Intent fingerprint changed: ${baseline.fingerprint.slice(0, 8)} -> ${fingerprint.slice(0, 8)}`, suggested_fix: "Create dgl/intent-acknowledgements/<sha>.md and rerun reach dgl baseline --intent.", line: 1 });
      }
    }
  }
  timings.intent = Date.now() - intentStart;

  const openStart = Date.now();
  const specs = discoverOpenApiSpecs(process.cwd());
  let openapiSummary = { scanned_specs: [] as string[], breaking: 0, warnings: 0 };
  if (specs.length > 0) {
    const compat = compareOpenApi(specs[0], specs[0], process.cwd());
    openapiSummary = compat.summary;
    violations.push(...compat.violations);
  }
  timings.openapi = Date.now() - openStart;

  const turbulence = files.slice(0, 10).map((p) => ({ path: p, reason: "recently changed", count: 1 }));
  const bySeverity = (s: "error" | "warn") => violations.filter((v) => v.severity === s).length;

  const report: DglReport = {
    schema_version: "1.0.0",
    run_id: `dgl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    repo,
    base_sha: baseSha,
    head_sha: headSha,
    summary: {
      intent_alignment_score: Math.max(0, 100 - bySeverity("error") * 20),
      terminology_drift_score: 100,
      semantic_drift_score: Math.max(0, 100 - violations.filter((v) => v.type === "semantic" || v.type === "api_contract").length * 10),
      trust_boundary_change_score: Math.max(0, 100 - violations.filter((v) => v.type === "trust_boundary").length * 30),
      calibration_score: 50,
    },
    timings_ms: timings,
    openapi_compat_summary: openapiSummary,
    violations,
    turbulence_hotspots: turbulence,
  };

  fs.writeFileSync(cacheFile, JSON.stringify(report, null, 2));
  return report;
}

export function toMarkdown(report: DglReport): string {
  const lines = [
    `# DGL Report (${report.run_id})`,
    "",
    `- Base: ${report.base_sha}`,
    `- Head: ${report.head_sha}`,
    `- Intent Alignment: ${report.summary.intent_alignment_score}`,
    `- Semantic Drift: ${report.summary.semantic_drift_score}`,
    `- OpenAPI Breaking: ${report.openapi_compat_summary?.breaking ?? 0}`,
    "",
    "## Violations",
  ];
  if (report.violations.length === 0) {
    lines.push("No violations detected.");
  } else {
    for (const v of report.violations) {
      lines.push(`- **${v.severity.toUpperCase()}** [${v.type}] ${v.paths.join(", ")}#L${v.line ?? 1} — ${v.suggested_fix}`);
    }
  }
  return lines.join("\n");
}

export function toSarif(report: DglReport): Record<string, unknown> {
  return {
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "reach-dgl", rules: [] } },
      results: report.violations.map((v) => ({
        level: v.severity === "error" ? "error" : "warning",
        message: { text: `${v.type}: ${v.suggested_fix}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: v.paths[0] || "unknown" }, region: { startLine: v.line ?? 1 } } }],
      })),
    }],
  };
}
