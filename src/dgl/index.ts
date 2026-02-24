import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execSync } from "child_process";
import type { DglReport, DglViolation } from "./types.js";
import { diffAstExports } from "./ast-diff.js";
import { diffApiContract } from "./api-contract-diff.js";

const TRUST_BOUNDARY = ["auth", "tenant", "secret", "webhook", "payment", "raw body"];

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

export function scanDgl(baseSha: string, headSha: string): DglReport {
  const repo = path.basename(process.cwd());
  const diffFiles = git(`diff --name-only ${baseSha} ${headSha}`).split("\n").filter(Boolean);
  const violations: DglViolation[] = [];

  for (const f of diffFiles) {
    const lower = f.toLowerCase();
    if (TRUST_BOUNDARY.some((k) => lower.includes(k))) {
      const line = 1;
      violations.push({
        type: "trust_boundary",
        severity: "error",
        paths: [f],
        evidence: "Changed file intersects trust-boundary keyword set.",
        suggested_fix: "Add targeted tests and acknowledgment under dgl/intent-acknowledgements/.",
        line,
      });
    }

    if (f.includes("package.json") || f.includes("go.mod") || f.includes("Cargo.toml")) {
      violations.push({
        type: "dependency_graph",
        severity: "warn",
        paths: [f],
        evidence: "Dependency declaration changed.",
        suggested_fix: "Review high-risk deps (auth/network/crypto/telemetry) before merge.",
        line: 1,
      });
    }

    violations.push(...semanticViolations(baseSha, headSha, f));
  }

  const manifest = path.join(process.cwd(), "docs/architecture/intent-manifest.json");
  if (fs.existsSync(manifest)) {
    const fingerprint = computeIntentFingerprint(manifest);
    const branch = git("rev-parse --abbrev-ref HEAD").replace(/\//g, "_");
    const baselinePath = path.join(process.cwd(), "dgl/baselines/intent", `${branch}.json`);
    if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as { fingerprint: string };
      if (baseline.fingerprint !== fingerprint) {
        violations.push({
          type: "intent",
          severity: "error",
          paths: ["docs/architecture/intent-manifest.json"],
          evidence: `Intent fingerprint changed: ${baseline.fingerprint.slice(0, 8)} -> ${fingerprint.slice(0, 8)}`,
          suggested_fix: "Create dgl/intent-acknowledgements/<sha>.md and rerun reach dgl baseline --intent.",
          line: 1,
        });
      }
    }
  }

  const turbulence = diffFiles.slice(0, 10).map((p) => ({ path: p, reason: "recently changed", count: 1 }));
  const bySeverity = (s: "error" | "warn") => violations.filter((v) => v.severity === s).length;

  return {
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
    violations,
    turbulence_hotspots: turbulence,
  };
}

export function toMarkdown(report: DglReport): string {
  const lines = [
    `# DGL Report (${report.run_id})`,
    "",
    `- Base: ${report.base_sha}`,
    `- Head: ${report.head_sha}`,
    `- Intent Alignment: ${report.summary.intent_alignment_score}`,
    `- Semantic Drift: ${report.summary.semantic_drift_score}`,
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
    runs: [
      {
        tool: { driver: { name: "reach-dgl", rules: [] } },
        results: report.violations.map((v) => ({
          level: v.severity === "error" ? "error" : "warning",
          message: { text: `${v.type}: ${v.suggested_fix}` },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: v.paths[0] || "unknown" },
                region: {
                  startLine: v.line ?? 1,
                },
              },
            },
          ],
        })),
      },
    ],
  };
}
