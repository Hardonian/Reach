// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";

export interface AnalyzePrArgs {
  target?: string;
  format: "text" | "json";
  explain: boolean;
  policy?: string;
  context?: string;
  safe: boolean;
  assist: boolean;
  base?: string;
  head?: string;
  maxFiles: number;
  maxDiffBytes: number;
}

type Severity = "low" | "medium" | "high";
type FindingCategory =
  | "security"
  | "data-integrity"
  | "reliability"
  | "performance"
  | "test-impact";

interface DiffHunkRef {
  file: string;
  oldStart: number;
  newStart: number;
  added: number;
  removed: number;
  hash: string;
}

interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  file: string;
  line_range: [number, number] | null;
  description: string;
  why_it_matters: string;
  suggested_next_action: string;
  evidence: string[];
}

interface AnalysisResult {
  schemaVersion: "2.0.0";
  run_id: string;
  summary: {
    risk_score: number;
    top_domains: string[];
    must_review_count: number;
  };
  input: {
    target: string;
    mode: "diff-file" | "git-range" | "git-target";
    context: string | null;
    safe_mode: boolean;
    policy_pack: string | null;
    generated_at: string;
  };
  fingerprints: {
    diff_hash: string;
    policy_hash: string | null;
    repo_hash: string | null;
  };
  policies_triggered: string[];
  findings: Finding[];
  suggested_evidence_to_collect: string[];
  replay: {
    artifact_dir: string;
    manifest_hash: string;
  };
  nondeterministic_assist?: {
    enabled: true;
    gated: true;
    reason: "nondeterministic assist disabled by default";
  };
}

const EXIT_CODES = {
  OK: 0,
  INPUT_ERROR: 2,
  MISSING_DEPENDENCY: 3,
  POLICY_FAIL: 4,
  INTERNAL_ERROR: 5,
} as const;

const FINDING_SORT = (a: Finding, b: Finding): number =>
  a.category.localeCompare(b.category) ||
  b.severity.localeCompare(a.severity) ||
  a.file.localeCompare(b.file) ||
  a.id.localeCompare(b.id);

function parseAnalyzePrArgs(argv: string[]): AnalyzePrArgs {
  const result: AnalyzePrArgs = {
    format: "text",
    explain: false,
    safe: false,
    assist: false,
    maxFiles: 300,
    maxDiffBytes: 2_000_000,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--json") result.format = "json";
    else if (
      arg === "--format" &&
      next &&
      (next === "text" || next === "json")
    ) {
      result.format = next;
      i++;
    } else if (arg === "--explain") result.explain = true;
    else if (arg === "--policy" && next) {
      result.policy = next;
      i++;
    } else if (arg === "--context" && next) {
      result.context = next;
      i++;
    } else if (arg === "--safe") result.safe = true;
    else if (arg === "--assist") result.assist = true;
    else if (arg === "--base" && next) {
      result.base = next;
      i++;
    } else if (arg === "--head" && next) {
      result.head = next;
      i++;
    } else if (arg === "--max-files" && next) {
      result.maxFiles = Number(next);
      i++;
    } else if (arg === "--max-diff-bytes" && next) {
      result.maxDiffBytes = Number(next);
      i++;
    } else if (!arg.startsWith("-") && !result.target) {
      result.target = arg;
    }
  }
  return result;
}

function isLikelyRange(value: string): boolean {
  return (
    value.includes("..") &&
    !value.endsWith(".diff") &&
    !value.endsWith(".patch")
  );
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10_000,
  });
}

function resolvePolicyHash(policyPath?: string): string | null {
  if (!policyPath) return null;
  const resolved = resolve(process.cwd(), policyPath);
  if (!existsSync(resolved)) return null;
  return createHash("sha256").update(readFileSync(resolved)).digest("hex");
}

function parseHunks(diff: string): DiffHunkRef[] {
  const hunks: DiffHunkRef[] = [];
  let currentFile = "unknown";
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) currentFile = line.slice(6).trim();
    else if (line.startsWith("@@")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!m) continue;
      const oldStart = Number(m[1]);
      const removed = Number(m[2] || "1");
      const newStart = Number(m[3]);
      const added = Number(m[4] || "1");
      const hash = createHash("sha1")
        .update(`${currentFile}:${line}`)
        .digest("hex")
        .slice(0, 12);
      hunks.push({
        file: currentFile,
        oldStart,
        newStart,
        added,
        removed,
        hash,
      });
    }
  }
  return hunks;
}

function parseModifiedFiles(diff: string): string[] {
  const files = new Set<string>();
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+++ b/")) continue;
    const file = line.slice(6).trim();
    if (file && file !== "/dev/null") files.add(file);
  }
  return [...files].sort();
}

function loadInput(
  target: string | undefined,
  args: AnalyzePrArgs,
): {
  diff: string;
  mode: AnalysisResult["input"]["mode"];
  target: string;
  repoHash: string | null;
} {
  if (args.base && args.head) {
    const range = `${args.base}..${args.head}`;
    return {
      diff: runGit(["diff", "--no-color", range]),
      mode: "git-range",
      target: range,
      repoHash: runGit(["rev-parse", "HEAD"]).trim(),
    };
  }

  if (
    target &&
    existsSync(resolve(process.cwd(), target)) &&
    statSync(resolve(process.cwd(), target)).isFile()
  ) {
    const safe = resolve(process.cwd(), target);
    const rel = relative(process.cwd(), safe);
    if (rel.startsWith("..")) throw new Error("E_INPUT_PATH_TRAVERSAL");
    return {
      diff: readFileSync(safe, "utf8"),
      mode: "diff-file",
      target,
      repoHash: null,
    };
  }

  if (target && isLikelyRange(target)) {
    return {
      diff: runGit(["diff", "--no-color", target]),
      mode: "git-range",
      target,
      repoHash: runGit(["rev-parse", "HEAD"]).trim(),
    };
  }

  if (target)
    return {
      diff: runGit(["diff", "--no-color", "--", target]),
      mode: "git-target",
      target,
      repoHash: runGit(["rev-parse", "HEAD"]).trim(),
    };

  return {
    diff: runGit(["diff", "--cached", "--no-color"]),
    mode: "git-target",
    target: "--cached",
    repoHash: runGit(["rev-parse", "HEAD"]).trim(),
  };
}

// deterministic risk algorithm: weighted sum by severity, capped at 100; stable finding ordering required for replay parity.
function scoreFindings(findings: Finding[], files: string[]): number {
  const base = Math.min(20, Math.max(4, files.length * 2));
  const severityWeight: Record<Severity, number> = {
    low: 4,
    medium: 10,
    high: 18,
  };
  return Math.min(
    100,
    base +
      findings.reduce(
        (sum, finding) => sum + severityWeight[finding.severity],
        0,
      ),
  );
}

function analyze(
  diff: string,
  files: string[],
  hunks: DiffHunkRef[],
): Finding[] {
  const findings: Finding[] = [];
  const fileToHunk = new Map<string, DiffHunkRef[]>();
  for (const hunk of hunks)
    fileToHunk.set(hunk.file, [...(fileToHunk.get(hunk.file) ?? []), hunk]);

  const addFinding = (
    finding: Omit<Finding, "id" | "evidence"> & { evidence?: string[] },
  ): void => {
    const fileHunks = fileToHunk.get(finding.file) ?? [];
    const evidence =
      finding.evidence ??
      fileHunks.slice(0, 2).map((h) => `${h.file}#${h.hash}`);
    const idSource = `${finding.category}:${finding.file}:${finding.description}`;
    findings.push({
      id: createHash("sha1").update(idSource).digest("hex").slice(0, 12),
      evidence,
      ...finding,
    });
  };

  const lines = diff.split("\n");
  for (const file of files) {
    const lower = file.toLowerCase();
    const lineRange: [number, number] | null = fileToHunk.get(file)?.[0]
      ? [
          fileToHunk.get(file)![0].newStart,
          fileToHunk.get(file)![0].newStart +
            Math.max(fileToHunk.get(file)![0].added - 1, 0),
        ]
      : null;
    if (/(auth|session|jwt|cookie|csrf)/.test(lower)) {
      addFinding({
        category: "security",
        severity: "high",
        file,
        line_range: lineRange,
        description: "Authentication or session surface changed",
        why_it_matters:
          "Auth boundary changes can shift access control guarantees.",
        suggested_next_action:
          "Require focused auth boundary review with explicit attack-surface notes.",
      });
    }
    if (/(migration|schema|prisma|sql)/.test(lower)) {
      addFinding({
        category: "data-integrity",
        severity: "high",
        file,
        line_range: lineRange,
        description: "Schema or migration file changed",
        why_it_matters:
          "Schema changes can break compatibility and rollback safety.",
        suggested_next_action:
          "Document backward/forward compatibility and rollback plan.",
      });
    }
    if (
      /(docker|helm|k8s|terraform|workflow|deploy|\.env|config)/.test(lower)
    ) {
      addFinding({
        category: "data-integrity",
        severity: "medium",
        file,
        line_range: lineRange,
        description: "Deployment or config path changed",
        why_it_matters:
          "Configuration drift can alter runtime behavior across environments.",
        suggested_next_action:
          "Compare effective configuration between environments before rollout.",
      });
    }
    if (
      /(service|controller|api|handler|query)/.test(lower) &&
      !/(test|spec)/.test(lower)
    ) {
      addFinding({
        category: "test-impact",
        severity: "low",
        file,
        line_range: lineRange,
        description: "Runtime code changed without direct test-file signal",
        why_it_matters:
          "Behavioral changes without tests increase regression risk.",
        suggested_next_action:
          "Add or update tests that cover the changed runtime path.",
      });
    }
  }

  for (const line of lines) {
    if (!line.startsWith("+")) continue;
    if (
      /\b(password|api[_-]?key|secret|token)\b\s*[:=]\s*['"][^'"]{8,}/i.test(
        line,
      )
    ) {
      addFinding({
        category: "security",
        severity: "high",
        file: "[diff-content]",
        line_range: null,
        description: "Potential secret detected in added lines",
        why_it_matters:
          "Committed secrets create immediate credential exposure risk.",
        suggested_next_action:
          "Rotate exposed secret material and replace with secure reference.",
        evidence: ["diff#line-secret-pattern"],
      });
    }
    if (
      /fetch\(|axios\.|http\.request|https\.request|new URL\(/.test(line) &&
      /\$\{|req\.|query|params/.test(line)
    ) {
      addFinding({
        category: "security",
        severity: "medium",
        file: "[diff-content]",
        line_range: null,
        description: "Dynamic network target construction detected",
        why_it_matters:
          "Dynamic outbound targets can expand SSRF attack paths.",
        suggested_next_action:
          "Constrain outbound destinations with allowlist validation.",
        evidence: ["diff#line-network-pattern"],
      });
    }
    if (
      /catch\s*\(.*\)\s*\{\s*\}/.test(line) ||
      /\.catch\(\s*\(?.*\)?\s*=>\s*\{\s*\}\s*\)/.test(line)
    ) {
      addFinding({
        category: "reliability",
        severity: "medium",
        file: "[diff-content]",
        line_range: null,
        description: "Error handling appears to swallow exceptions",
        why_it_matters:
          "Silent failures reduce observability and can hide correctness issues.",
        suggested_next_action:
          "Log structured context and propagate actionable errors.",
        evidence: ["diff#line-error-handling"],
      });
    }
    if (
      /\b(timeout|retry|maxRetries)\b/.test(line) &&
      /0|false|null/.test(line)
    ) {
      addFinding({
        category: "reliability",
        severity: "medium",
        file: "[diff-content]",
        line_range: null,
        description: "Timeout or retry guard may be disabled",
        why_it_matters:
          "Removing retry/timeouts can amplify outage blast radius.",
        suggested_next_action:
          "Validate timeout/retry policy against service-level objectives.",
        evidence: ["diff#line-timeout-retry"],
      });
    }
    if (
      /for\s*\(.*await.*\)|for\s*\(.*\)/.test(line) &&
      /(findUnique|findOne|SELECT)/i.test(line)
    ) {
      addFinding({
        category: "performance",
        severity: "medium",
        file: "[diff-content]",
        line_range: null,
        description: "Loop plus query pattern detected",
        why_it_matters: "Looped queries often introduce N+1 latency growth.",
        suggested_next_action: "Batch or prefetch data access in the hot path.",
        evidence: ["diff#line-n-plus-one"],
      });
    }
  }

  return findings.sort(FINDING_SORT);
}

function artifactDir(runId: string): string {
  return resolve(process.cwd(), ".zeo", "analyze-pr", runId);
}

function writeArtifacts(result: AnalysisResult, explain: boolean): void {
  const dir = artifactDir(result.run_id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "findings.json"),
    `${JSON.stringify(result.findings, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, "summary.json"),
    `${JSON.stringify(result.summary, null, 2)}\n`,
    "utf8",
  );
  if (explain)
    writeFileSync(
      join(dir, "explain.json"),
      `${JSON.stringify(
        result.findings.map((f) => ({
          id: f.id,
          why_it_matters: f.why_it_matters,
        })),
        null,
        2,
      )}\n`,
      "utf8",
    );

  const manifest = {
    run_id: result.run_id,
    schemaVersion: result.schemaVersion,
    files: [
      "findings.json",
      "summary.json",
      ...(explain ? ["explain.json"] : []),
    ],
    hashes: {
      findings: createHash("sha256")
        .update(JSON.stringify(result.findings))
        .digest("hex"),
      summary: createHash("sha256")
        .update(JSON.stringify(result.summary))
        .digest("hex"),
    },
  };
  const manifestHash = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  writeFileSync(
    join(dir, "manifest.json"),
    `${JSON.stringify({ ...manifest, manifest_hash: manifestHash }, null, 2)}\n`,
    "utf8",
  );
}

function buildText(result: AnalysisResult, explain: boolean): string {
  const mustReview = result.findings
    .filter((f) => f.severity === "high")
    .slice(0, 5);
  const lines = [
    "=== Accountability summary ===",
    `run_id: ${result.run_id}`,
    `risk score: ${result.summary.risk_score}`,
    `top domains: ${result.summary.top_domains.join(", ") || "none"}`,
    "",
    "Must review:",
    ...(mustReview.length === 0
      ? ["- none"]
      : mustReview.map((f) => `- [${f.severity}] ${f.file}: ${f.description}`)),
    "",
    "Suggested evidence to collect:",
    ...(result.suggested_evidence_to_collect.length === 0
      ? ["- none"]
      : result.suggested_evidence_to_collect.map((x) => `- ${x}`)),
    "",
    "Policy triggers:",
    ...(result.policies_triggered.length === 0
      ? ["- none"]
      : result.policies_triggered.map((x) => `- ${x}`)),
    `Replay hash: ${result.replay.manifest_hash.slice(0, 16)}...`,
  ];

  if (explain) {
    lines.push("", "=== explain ===");
    for (const finding of result.findings)
      lines.push(
        `- ${finding.id} ${finding.why_it_matters} Evidence: ${finding.evidence.join(", ") || "none"}`,
      );
  }
  const ctas = [
    `Convert to decision? zeo decision create --from ${result.run_id}`,
    "Apply security pack? zeo init pack security-pack",
  ];
  return `${lines.join("\n")}\n\nNext steps:\n${ctas.map((line) => `- ${line}`).join("\n")}`;
}

function toAnalysis(
  target: string,
  loaded: ReturnType<typeof loadInput>,
  args: AnalyzePrArgs,
): AnalysisResult {
  const files = parseModifiedFiles(loaded.diff);
  const hunks = parseHunks(loaded.diff);
  const findings = analyze(loaded.diff, files, hunks);
  const risk = scoreFindings(findings, files);
  const domains = new Set<string>(["ENG"]);
  for (const finding of findings) {
    if (finding.category === "security") domains.add("SEC");
    if (
      finding.category === "data-integrity" ||
      finding.category === "reliability" ||
      finding.category === "performance"
    )
      domains.add("OPS");
  }

  const run_id = randomUUID();
  const policies = [
    ...(args.policy ? [`policy-pack:${args.policy}`] : []),
    ...findings
      .filter((f) => f.category === "security")
      .map(() => "security-review-required"),
    ...findings
      .filter((f) => f.category === "data-integrity")
      .map(() => "data-integrity-review-required"),
  ];
  const dedupePolicies = [...new Set(policies)].sort();

  const suggestedEvidence = [
    ...new Set(findings.map((f) => f.suggested_next_action)),
  ].sort();
  const diffHash = createHash("sha256").update(loaded.diff).digest("hex");
  const manifestHash = createHash("sha256")
    .update(JSON.stringify({ diffHash, findings }))
    .digest("hex");

  return {
    schemaVersion: "2.0.0",
    run_id,
    summary: {
      risk_score: risk,
      top_domains: [...domains].sort(),
      must_review_count: findings.filter((f) => f.severity === "high").length,
    },
    input: {
      target,
      mode: loaded.mode,
      context: args.context ?? null,
      safe_mode: args.safe,
      policy_pack: args.policy ?? null,
      generated_at: "1970-01-01T00:00:00.000Z",
    },
    fingerprints: {
      diff_hash: diffHash,
      policy_hash: resolvePolicyHash(args.policy),
      repo_hash: loaded.repoHash,
    },
    policies_triggered: dedupePolicies,
    findings,
    suggested_evidence_to_collect: suggestedEvidence,
    replay: {
      artifact_dir: artifactDir(run_id),
      manifest_hash: manifestHash,
    },
    ...(args.assist && !args.safe
      ? {
          nondeterministic_assist: {
            enabled: true as const,
            gated: true as const,
            reason: "nondeterministic assist disabled by default" as const,
          },
        }
      : {}),
  };
}

export async function runAnalyzePrCommand(argv: string[]): Promise<number> {
  try {
    const args = parseAnalyzePrArgs(argv);
    if (
      !Number.isFinite(args.maxFiles) ||
      args.maxFiles <= 0 ||
      !Number.isFinite(args.maxDiffBytes) ||
      args.maxDiffBytes <= 0
    ) {
      console.error(
        "[E_INPUT_INVALID] max-files and max-diff-bytes must be positive numbers",
      );
      return EXIT_CODES.INPUT_ERROR;
    }
    if (args.safe && args.assist) {
      console.error("[E_INPUT_INVALID] --safe and --assist cannot be combined");
      return EXIT_CODES.INPUT_ERROR;
    }

    const target = args.target ?? "--cached";
    let loaded: ReturnType<typeof loadInput>;
    try {
      loaded = loadInput(args.target, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("spawnSync git") || message.includes("not found"))
        return EXIT_CODES.MISSING_DEPENDENCY;
      console.error(`[E_INPUT_LOAD] ${message}`);
      return EXIT_CODES.INPUT_ERROR;
    }

    if (Buffer.byteLength(loaded.diff, "utf8") > args.maxDiffBytes) {
      console.error(
        `[E_INPUT_OVERSIZE] diff exceeds max bytes (${args.maxDiffBytes})`,
      );
      return EXIT_CODES.INPUT_ERROR;
    }

    const files = parseModifiedFiles(loaded.diff);
    if (files.length > args.maxFiles) {
      console.error(
        `[E_INPUT_OVERSIZE] file count ${files.length} exceeds max-files (${args.maxFiles})`,
      );
      return EXIT_CODES.INPUT_ERROR;
    }

    const analysis = toAnalysis(target, loaded, args);
    writeArtifacts(analysis, args.explain);

    if (
      analysis.policies_triggered.includes("policy-pack:enforce") &&
      analysis.summary.risk_score >= 75
    ) {
      process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
      return EXIT_CODES.POLICY_FAIL;
    }

    if (args.format === "text") console.log(buildText(analysis, args.explain));
    process.stdout.write(`${JSON.stringify(analysis, null, 2)}\n`);
    return EXIT_CODES.OK;
  } catch (err) {
    const runId = randomUUID();
    console.error(
      `[E_ANALYZE_INTERNAL] run_id=${runId} ${(err as Error).message}`,
    );
    return EXIT_CODES.INTERNAL_ERROR;
  }
}

export const __private__ = {
  parseAnalyzePrArgs,
  parseModifiedFiles,
  parseHunks,
  analyze,
  scoreFindings,
  toAnalysis,
};

// presence-check:
// - reused existing CLI command routing in apps/cli/src/index.ts
// - reused pack/policy path conventions from apps/cli/src/pack-cli.ts
// - reused replay artifact directory convention .zeo/analyze-pr

export function runAnalyzePrReplay(runId: string): number {
  const dir = artifactDir(runId);
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) return EXIT_CODES.INPUT_ERROR;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
    string,
    unknown
  >;
  const summaryPath = join(dir, "summary.json");
  const findingsPath = join(dir, "findings.json");
  const summary = existsSync(summaryPath)
    ? JSON.parse(readFileSync(summaryPath, "utf8"))
    : null;
  const findings = existsSync(findingsPath)
    ? JSON.parse(readFileSync(findingsPath, "utf8"))
    : [];
  process.stdout.write(
    `${JSON.stringify({ run_id: runId, manifest, summary, findings }, null, 2)}\n`,
  );
  return EXIT_CODES.OK;
}
