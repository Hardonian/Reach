import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import type { AgentContract, DglReport, DglViolation } from "./types.js";
import { diffAstExports } from "./ast-diff.js";
import { diffApiContract } from "./api-contract-diff.js";
import { compareOpenApi, discoverOpenApiSpecs } from "./openapi-compat.js";

const TRUST_BOUNDARY = ["auth", "tenant", "secret", "webhook", "payment", "raw body", "billing", "encrypt"];
const SCHEMA_VERSION = "1.1.0" as const;
const TOOL_VERSION = "0.5.0";

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

function sha256File(relPath: string): string {
  const abs = path.join(process.cwd(), relPath);
  if (!fs.existsSync(abs)) return "missing";
  return createHash("sha256").update(fs.readFileSync(abs, "utf-8")).digest("hex");
}

export function computeContextSnapshotHash(): string {
  const architectureHash = sha256File("docs/architecture/dgl.md");
  const languageHash = sha256File("config/canonical-language.json");
  const intentHash = sha256File("docs/architecture/intent-manifest.json");
  return createHash("sha256").update([architectureHash, languageHash, intentHash].join("::")).digest("hex");
}

export function computeIntentFingerprint(manifestPath: string): string {
  const content = fs.readFileSync(manifestPath, "utf-8");
  return createHash("sha256").update(content).digest("hex");
}

export function validateAgentContractPayload(payload: unknown): { ok: boolean; errors: string[] } {
  const p = payload as Partial<AgentContract>;
  const errors: string[] = [];
  const enumTask = ["refactor", "bugfix", "docs", "security", "perf", "ui", "infra"];
  if (!p || typeof p !== "object") errors.push("payload must be an object");
  if (typeof p.provider !== "string" || !p.provider) errors.push("provider must be a non-empty string");
  if (typeof p.model !== "string" || !p.model) errors.push("model must be a non-empty string");
  if (typeof p.agent_id !== "string" || !p.agent_id) errors.push("agent_id must be a non-empty string");
  if (!enumTask.includes(String(p.task_class))) errors.push(`task_class must be one of: ${enumTask.join(", ")}`);
  if (!Array.isArray(p.changed_paths) || p.changed_paths.some((v) => typeof v !== "string")) errors.push("changed_paths must be an array of strings");
  if (typeof p.risk_summary !== "string") errors.push("risk_summary must be a string");
  if (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1) errors.push("confidence must be a number between 0 and 1");
  if (!Array.isArray(p.claimed_invariants_changed) || p.claimed_invariants_changed.some((v) => typeof v !== "string")) errors.push("claimed_invariants_changed must be an array of strings");
  if (typeof p.requires_acknowledgement !== "boolean") errors.push("requires_acknowledgement must be boolean");
  return { ok: errors.length === 0, errors };
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

function deriveBlastRadius(files: string[]) {
  const subsystem = new Set(files.map((f) => f.split("/")[0] ?? "root"));
  const depth = files.reduce((m, f) => Math.max(m, f.split("/").length), 0);
  const api = files.filter((f) => f.includes("/api/") || f.includes("openapi")).length;
  const bundleSensitive = files.filter((f) => /package\.json|tsconfig|next\.config|webpack|vite|rollup/i.test(f)).length;
  const publicSurface = files.filter((f) => /(^|\/)src\/|(^|\/)api\//.test(f)).length;
  const score = Math.min(100, Math.round(subsystem.size * 12 + depth * 6 + api * 10 + bundleSensitive * 12 + publicSurface * 4));
  return {
    score,
    subsystems_touched: subsystem.size,
    dependency_depth_impacted: depth,
    public_api_surface_affected: publicSurface,
    openapi_endpoints_touched: api,
    bundle_sensitive_files_touched: bundleSensitive,
  };
}

function perfComplexityViolations(files: string[]): DglViolation[] {
  const out: DglViolation[] = [];
  const threshold = readJson(path.join(process.cwd(), "config", "dgl-performance.json"), { nested_loop_threshold: 2, import_graph_growth_warn: 30, import_graph_growth_error: 80, cyclomatic_warn: 15, cyclomatic_error: 30 });
  for (const f of files.filter((x) => /\.(ts|tsx|js|jsx|go|rs)$/.test(x) && fs.existsSync(path.join(process.cwd(), x)))) {
    const text = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
    const nestedLoops = (text.match(/for\s*\(|while\s*\(/g) ?? []).length;
    const syncBlocking = /readFileSync|execSync|writeFileSync/.test(text) && f.includes("/api/");
    const importCount = (text.match(/^\s*import\s+/gm) ?? []).length;
    if (nestedLoops > threshold.nested_loop_threshold) out.push({ type: "performance", severity: nestedLoops > threshold.nested_loop_threshold + 2 ? "error" : "warn", paths: [f], evidence: `Detected ${nestedLoops} loops; threshold ${threshold.nested_loop_threshold}.`, suggested_fix: "Refactor nested loops or add indexing to reduce worst-case complexity.", line: 1 });
    if (syncBlocking) out.push({ type: "performance", severity: "warn", paths: [f], evidence: "Synchronous blocking call found in route layer.", suggested_fix: "Use async non-blocking IO on route-layer paths.", line: 1 });
    if (importCount > threshold.import_graph_growth_error) out.push({ type: "performance", severity: "error", paths: [f], evidence: `Large import graph footprint (${importCount} imports).`, suggested_fix: "Split module or reduce transitive import fan-out.", line: 1 });
    else if (importCount > threshold.import_graph_growth_warn) out.push({ type: "performance", severity: "warn", paths: [f], evidence: `Import graph growth warning (${importCount} imports).`, suggested_fix: "Review module boundaries for high fan-in/fan-out.", line: 1 });
  }
  return out;
}

function forecastDriftScore(providerMatrix: DglReport["provider_matrix"], blastRadius: number, trustTouches: number): number {
  const basePrior = 0.2;
  if (!providerMatrix || providerMatrix.length === 0) return Math.min(1, basePrior + blastRadius / 180 + trustTouches * 0.15);
  const avgRevert = providerMatrix.reduce((n, r) => n + r.revert_ratio, 0) / providerMatrix.length;
  return Math.min(1, Math.max(0, basePrior + avgRevert * 0.6 + blastRadius / 220 + trustTouches * 0.18));
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
  const securityConfig = readJson<string[]>(path.join(process.cwd(), "config", "dgl-security-boundaries.json"), ["auth/", "billing/", "webhook", "encrypt", "raw-body"]);
  for (const f of files) {
    const lower = f.toLowerCase();
    if (TRUST_BOUNDARY.some((k) => lower.includes(k)) || securityConfig.some((k) => lower.includes(k.toLowerCase().replace("**", "")))) {
      violations.push({ type: "trust_boundary", severity: "error", paths: [f], evidence: "Changed file intersects trust-boundary keyword set.", suggested_fix: "Add targeted tests and acknowledgement under dgl/intent-acknowledgements/.", line: 1 });
    }
    if (f.includes("package.json") || f.includes("go.mod") || f.includes("Cargo.toml")) {
      violations.push({ type: "dependency_graph", severity: "warn", paths: [f], evidence: "Dependency declaration changed.", suggested_fix: "Review high-risk deps (auth/network/crypto/telemetry) before merge.", line: 1 });
    }
  }
  timings.trust_boundary = Date.now() - trustStart;

  const semStart = Date.now();
  for (const f of files) violations.push(...semanticViolations(baseSha, headSha, f));
  violations.push(...perfComplexityViolations(files));
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
  const contextHash = computeContextSnapshotHash();
  const baselineContextPath = path.join(process.cwd(), "dgl", "baselines", "context.hash");
  const documentationTouched = files.some((f) => f.startsWith("docs/"));
  if (fs.existsSync(baselineContextPath)) {
    const prior = fs.readFileSync(baselineContextPath, "utf-8").trim();
    if (prior && prior !== contextHash && !documentationTouched) {
      violations.push({ type: "memory_context", severity: "warn", paths: ["docs/architecture/dgl.md"], evidence: "Context snapshot hash changed without documentation update.", suggested_fix: "Update docs or refresh dgl/baselines/context.hash intentionally.", line: 1 });
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

  const blast = deriveBlastRadius(files);
  const turbulence = files.slice(0, 30).map((p) => ({ path: p, reason: "recently changed", count: 1 }));
  const bySeverity = (s: "error" | "warn") => violations.filter((v) => v.severity === s).length;

  const providerMatrixPath = path.join(process.cwd(), "dgl", "reports", "provider-matrix.json");
  const providerMatrix = readJson<DglReport["provider_matrix"]>(providerMatrixPath, []);
  const diffStats = git(`diff --numstat ${baseSha} ${headSha}`).split("\n").filter(Boolean);
  const diffSize = diffStats.reduce((n, line) => {
    const [a, d] = line.split("\t");
    return n + (Number(a) || 0) + (Number(d) || 0);
  }, 0);

  const report: DglReport = {
    schema_version: SCHEMA_VERSION,
    run_id: `dgl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    repo,
    base_sha: baseSha,
    head_sha: headSha,
    context_hash: contextHash,
    blast_radius: blast,
    economics: {
      tokens_consumed: Number(process.env.REACH_DGL_TOKENS ?? 0),
      diff_size: diffSize,
      passes_to_converge: Number(process.env.REACH_DGL_PASSES ?? 1),
      repair_cycles: Number(process.env.REACH_DGL_REPAIRS ?? 0),
      cost_per_accepted_change: Number(process.env.REACH_DGL_COST ?? 0),
    },
    summary: {
      intent_alignment_score: Math.max(0, 100 - bySeverity("error") * 20),
      terminology_drift_score: 100,
      semantic_drift_score: Math.max(0, 100 - violations.filter((v) => v.type === "semantic" || v.type === "api_contract").length * 10),
      trust_boundary_change_score: Math.max(0, 100 - violations.filter((v) => v.type === "trust_boundary").length * 30),
      calibration_score: 50,
      blast_radius_score: blast.score,
    },
    timings_ms: timings,
    openapi_compat_summary: openapiSummary,
    violations,
    provider_matrix: providerMatrix,
    drift_forecast_score: forecastDriftScore(providerMatrix, blast.score, violations.filter((v) => v.type === "trust_boundary").length),
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
    `- Context Hash: ${report.context_hash ?? "n/a"}`,
    `- Blast Radius: ${report.blast_radius?.score ?? 0}`,
    `- Drift Forecast: ${((report.drift_forecast_score ?? 0) * 100).toFixed(1)}%`,
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
