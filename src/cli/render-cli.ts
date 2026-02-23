// @ts-nocheck
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import type { DashboardPersona, DashboardViewModel } from "@zeo/contracts";
import { loadOrGenerateDashboardViewModel, stableStringify } from "../lib/generateViewModel.js";

export type RenderTarget = "github-pr" | "slack" | "markdown" | "plain";

type ShareChannel = "github" | "slack";

interface SecretScanResult {
  hasHighRisk: boolean;
  redacted: string;
}

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /\b(?:api[_-]?key|token|secret|password)\b\s*[:=]\s*["']?([A-Za-z0-9_-]{8,})["']?/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function parseFlag(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function parseTarget(value?: string): RenderTarget {
  if (value === "github-pr" || value === "slack" || value === "markdown" || value === "plain")
    return value;
  return "plain";
}

function detectNoExternalShare(model: DashboardViewModel): boolean {
  return model.lists.policies.some(
    (policy) => policy.id.includes("no-external-share") || policy.id.includes("internal-only"),
  );
}

function scanAndRedact(input: string, enabled: boolean): SecretScanResult {
  if (!enabled)
    return {
      hasHighRisk: SECRET_PATTERNS.some((pattern) => pattern.test(input)),
      redacted: input,
    };
  let output = input;
  let hasHit = false;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, () => {
      hasHit = true;
      return "[REDACTED_SECRET]";
    });
  }
  return { hasHighRisk: hasHit, redacted: output };
}

function topRisks(model: DashboardViewModel): string[] {
  return model.lists.findings
    .slice()
    .sort(
      (a, b) =>
        b.severity - a.severity ||
        (a.file ?? "").localeCompare(b.file ?? "") ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3)
    .map(
      (finding) =>
        `- S${finding.severity} ${finding.title}${finding.file ? ` (${finding.file})` : ""}`,
    );
}

function policySummary(model: DashboardViewModel): string[] {
  return model.lists.policies
    .slice()
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((policy) => `- ${policy.id} [${policy.status}]`);
}

function verificationLine(model: DashboardViewModel): string {
  return model.verificationStatus.verified ? "Replay Verified" : "Not Verified";
}

function renderOutput(model: DashboardViewModel, target: RenderTarget, compact: boolean): string {
  const topRiskLines = topRisks(model);
  const policyLines = policySummary(model);
  const ctas = model.ctas.slice(0, compact ? 3 : 5).map((cta) => `- ${cta.command}`);
  const manifestHash = model.fingerprint.artifactsHash;
  const verify = verificationLine(model);

  if (target === "github-pr") {
    return [
      `# Zeo Review: Risk ${model.summary.riskScore}/100 • Policy ${model.summary.policyCompliance}% • Replay ${model.summary.replayStability}%`,
      "",
      "## Top Risks",
      ...(topRiskLines.length ? topRiskLines : ["- none"]),
      "",
      "## Policy Triggers",
      ...(policyLines.length ? policyLines : ["- none"]),
      "",
      "## Next Steps",
      ...ctas,
      "",
      "## Verification",
      `- manifestHash: ${manifestHash}`,
      `- replay: ${verify}`,
      "- signature: unsigned",
      "",
      "Reproduce:",
      `- zeo replay ${model.id}`,
      `- zeo analyze-pr ${model.id}`,
      "",
    ].join("\n");
  }

  if (target === "slack") {
    return [
      `*Zeo Review* • Risk ${model.summary.riskScore}/100 • Policy ${model.summary.policyCompliance}% • ${verify}`,
      ...topRiskLines,
      `CTA 1: ${model.ctas[0]?.command ?? "zeo view " + model.id}`,
      `CTA 2: ${model.ctas[1]?.command ?? "zeo export bundle --decision " + model.id}`,
      `Verification hash: ${manifestHash.slice(0, 20)}...`,
    ].join("\n");
  }

  if (target === "markdown") {
    const evidenceRows = model.lists.evidence
      .slice(0, 8)
      .map((ev) => `| ${ev.id} | ${ev.qualityScore} | ${ev.freshness} | ${ev.ageDays} |`);
    const findingRows = model.lists.findings
      .slice(0, 8)
      .map((f) => `| ${f.id} | ${f.severity} | ${f.title} | ${f.file ?? ""} |`);
    const policyRows = model.lists.policies
      .slice(0, 8)
      .map((p) => `| ${p.id} | ${p.status} | ${p.severity} |`);
    return [
      `# Zeo Report ${model.id}`,
      "",
      "## Status",
      model.story.statusLine,
      "## Change",
      model.story.changeLine,
      "## Cause",
      model.story.causeLine,
      "## Action",
      model.story.actionLine,
      "",
      "## Findings",
      "| Id | Severity | Title | File |",
      "|---|---:|---|---|",
      ...(findingRows.length ? findingRows : ["| none | 0 | none | |"]),
      "",
      "## Evidence",
      "| Id | Quality | Freshness | AgeDays |",
      "|---|---:|---|---:|",
      ...(evidenceRows.length ? evidenceRows : ["| none | 0 | unknown | 0 |"]),
      "",
      "## Policies",
      "| Id | Status | Severity |",
      "|---|---|---:|",
      ...(policyRows.length ? policyRows : ["| none | pass | 0 |"]),
      "",
      "## Next Actions",
      ...ctas,
      "",
      `Verification: ${verify} (${manifestHash})`,
      "",
    ].join("\n");
  }

  return [
    `Zeo ${model.id} Risk ${model.summary.riskScore}/100 Policy ${model.summary.policyCompliance}% ${verify}`,
    ...topRiskLines,
    ...ctas,
    `manifestHash=${manifestHash.slice(0, 16)}...`,
  ].join("\n");
}

function requireRedactOverride(argv: string[]): boolean {
  const redact = parseFlag(argv, "--redact");
  if (redact !== "off") return false;
  return !argv.includes("--i-know-what-im-doing");
}

function loadModel(id: string, persona: DashboardPersona): DashboardViewModel {
  return loadOrGenerateDashboardViewModel({ id, persona }).model;
}

export async function runRenderCommand(argv: string[]): Promise<number> {
  const id = argv[0];
  if (!id) {
    console.error(
      "Usage: zeo render <decisionId|runId> --target github-pr|slack|markdown|plain [--persona exec|tech|security] [--compact|--full]",
    );
    return 1;
  }
  if (requireRedactOverride(argv)) {
    console.error("Refusing --redact=off without --i-know-what-im-doing");
    return 1;
  }
  const personaRaw = parseFlag(argv, "--persona");
  const persona = (
    personaRaw === "tech" || personaRaw === "security" ? personaRaw : "exec"
  ) as DashboardPersona;
  const target = parseTarget(parseFlag(argv, "--target"));
  const compact = argv.includes("--compact") || !argv.includes("--full");
  const redactEnabled = parseFlag(argv, "--redact") !== "off";

  const model = loadModel(id, persona);
  const output = renderOutput(model, target, compact);
  const scanned = scanAndRedact(output, redactEnabled);
  if (scanned.hasHighRisk && !redactEnabled) {
    console.error(`Potential secret detected; run_id=${model.id}`);
    return 2;
  }
  process.stdout.write(`${scanned.redacted}\n`);
  return 0;
}

export async function runShareCommand(argv: string[]): Promise<number> {
  const channel = argv[0] as ShareChannel | undefined;
  const id = parseFlag(argv, "--id") ?? argv[1];
  if (!channel || (channel !== "github" && channel !== "slack") || !id) {
    console.error(
      "Usage: zeo share <github|slack> <runId> [--print] [--post] [--repo owner/name --pr 123]",
    );
    return 1;
  }
  const personaRaw = parseFlag(argv, "--persona");
  const persona = (
    personaRaw === "tech" || personaRaw === "security" ? personaRaw : "exec"
  ) as DashboardPersona;
  const model = loadModel(id, persona);
  const redactEnabled = parseFlag(argv, "--redact") !== "off";
  if (requireRedactOverride(argv)) {
    console.error("Refusing --redact=off without --i-know-what-im-doing");
    return 1;
  }

  const policyBlocked = detectNoExternalShare(model);
  const target: RenderTarget = channel === "github" ? "github-pr" : "slack";
  const rendered = renderOutput(model, target, true);
  const scanned = scanAndRedact(rendered, true);
  const post = argv.includes("--post");

  if (post && scanned.hasHighRisk) {
    console.error(`Blocked share --post due to high-risk token detection. run_id=${id}`);
    return 2;
  }
  if (post && policyBlocked) {
    console.error("Blocked share --post by policy pack (no external share).");
    return 2;
  }

  if (argv.includes("--print") || !post) {
    const finalText = scanAndRedact(rendered, redactEnabled).redacted;
    process.stdout.write(`${finalText}\n`);
    return 0;
  }

  if (channel === "github") {
    const token = process.env.GITHUB_TOKEN;
    const repo = parseFlag(argv, "--repo");
    const pr = parseFlag(argv, "--pr");
    if (!token || !repo || !pr) {
      console.log("GitHub token/repo/pr missing; print-first fallback:\n");
      process.stdout.write(`${scanned.redacted}\n`);
      return 0;
    }
    const [owner, name] = repo.split("/");
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${name}/issues/${pr}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "zeo-cli",
        },
        body: JSON.stringify({ body: scanned.redacted }),
      },
    );
    if (!response.ok) {
      console.error(`GitHub post failed: ${response.status}`);
      return 2;
    }
    console.log("Posted GitHub PR comment.");
    return 0;
  }

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.log("Slack webhook missing; print-first fallback:\n");
    process.stdout.write(`${scanned.redacted}\n`);
    return 0;
  }
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: scanned.redacted }),
  });
  if (!response.ok) {
    console.error(`Slack post failed: ${response.status}`);
    return 2;
  }
  console.log("Posted Slack message.");
  return 0;
}

function copyDir(src: string, dest: string): void {
  if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else writeFileSync(to, readFileSync(from));
  }
}

function zipDirectory(dir: string, outZip: string): void {
  const script = `import os, zipfile
root = r"${dir}"
out = r"${outZip}"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(root):
        for name in sorted(files):
            path = os.path.join(base, name)
            z.write(path, os.path.relpath(path, os.path.dirname(root)))
`;
  execFileSync("python3", ["-c", script], { stdio: "ignore" });
}

export async function runDemoCommand(argv: string[]): Promise<number> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = resolve(process.cwd(), "dist", "demo", stamp);
  mkdirSync(outDir, { recursive: true });

  const fixtures = [
    "examples/analyze-pr-auth/diff.patch",
    "examples/analyze-pr-migration/diff.patch",
    "examples/analyze-pr-performance/diff.patch",
  ];
  const { runAnalyzePrCommand } = await import("./analyze-pr-cli.js");

  const runIds: string[] = [];
  for (const fixture of fixtures) {
    const chunks: string[] = [];
    const original = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    await runAnalyzePrCommand([fixture, "--json"]);
    process.stdout.write = original;
    const output = chunks.join("\n");
    const match = /"run_id"\s*:\s*"([^"]+)"/.exec(output);
    if (match?.[1]) runIds.push(match[1]);
  }
  if (runIds.length === 0) {
    console.error("demo failed to generate run ids");
    return 1;
  }

  const id = runIds[0];
  const model = loadModel(id, "exec");
  const viewerDir = join(outDir, "viewer");
  mkdirSync(viewerDir, { recursive: true });
  writeFileSync(join(viewerDir, "dashboard.json"), stableStringify(model), "utf8");
  writeFileSync(
    join(outDir, "dashboard.html"),
    `<html><body><h1>Zeo Demo ${id}</h1><pre>${stableStringify(model).replace(/</g, "&lt;")}</pre></body></html>\n`,
    "utf8",
  );

  writeFileSync(join(outDir, "pr-comment.md"), renderOutput(model, "github-pr", false), "utf8");
  writeFileSync(join(outDir, "slack-message.txt"), renderOutput(model, "slack", true), "utf8");
  writeFileSync(join(outDir, "report.md"), renderOutput(model, "markdown", false), "utf8");

  const bundleDir = join(outDir, "bundle");
  copyDir(resolve(process.cwd(), ".zeo", "analyze-pr", id), bundleDir);
  const bundleHash = createHash("sha256")
    .update(readFileSync(join(bundleDir, "manifest.json"), "utf8"))
    .digest("hex");
  const bundleZip = join(outDir, "bundle.zip");
  zipDirectory(bundleDir, bundleZip);

  writeFileSync(
    join(outDir, "README.md"),
    [
      "# Zeo Demo",
      "",
      `Primary run: ${id}`,
      "",
      "Open:",
      "- dashboard.html",
      "- pr-comment.md",
      "- report.md",
      "",
      `Bundle hash: ${bundleHash}`,
    ].join("\n"),
    "utf8",
  );

  if (argv.includes("--zip")) {
    zipDirectory(outDir, join(resolve(process.cwd(), "dist", "demo"), `${stamp}.zip`));
  }

  if (argv.includes("--open")) {
    try {
      if (process.platform === "darwin") execFileSync("open", [join(outDir, "dashboard.html")]);
      else if (process.platform === "win32")
        execFileSync("cmd", ["/c", "start", join(outDir, "dashboard.html")]);
      else execFileSync("xdg-open", [join(outDir, "dashboard.html")]);
    } catch {
      console.log(`Open manually: ${join(outDir, "dashboard.html")}`);
    }
  }

  process.stdout.write(`${outDir}\n`);
  return 0;
}
