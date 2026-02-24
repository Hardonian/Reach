#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { scanDgl, toMarkdown, toSarif, computeIntentFingerprint } from "../src/dgl/index.js";
import { compareOpenApi } from "../src/dgl/openapi-compat.js";

const args = process.argv.slice(2);
const cmd = args[0] || "scan";
const flag = (name: string, fallback = "") => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
};
const git = (c: string) => execSync(`git ${c}`, { encoding: "utf-8" }).trim();
const base = flag("--base", git("rev-parse HEAD~1"));
const head = flag("--head", git("rev-parse HEAD"));
const changedOnly = !args.includes("--full");

const root = process.cwd();
const outDir = path.join(root, "dgl", "reports");
const runsDir = path.join(root, "dgl", "run-records");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(runsDir, { recursive: true });

if (cmd === "doctor") {
  console.log(JSON.stringify({
    changed_only_default: changedOnly,
    cache_dir: ".cache/dgl",
    outputs: ["dgl/reports/dgl_report.json", "dgl/reports/dgl_report.sarif", "dgl/reports/dgl_report.md"],
  }, null, 2));
  process.exit(0);
}

if (cmd === "intent") {
  const fp = computeIntentFingerprint(path.join(root, "docs/architecture/intent-manifest.json"));
  console.log(JSON.stringify({ fingerprint: fp }, null, 2));
  process.exit(0);
}

if (cmd === "baseline" && args.includes("--intent")) {
  const branch = git("rev-parse --abbrev-ref HEAD").replace(/\//g, "_");
  const fp = computeIntentFingerprint(path.join(root, "docs/architecture/intent-manifest.json"));
  const target = path.join(root, "dgl/baselines/intent", `${branch}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ branch, fingerprint: fp, updated_at: new Date().toISOString() }, null, 2));
  console.log(`intent baseline updated: ${target}`);
  process.exit(0);
}

if (cmd === "provider-matrix") {
  const store = path.join(root, "dgl", "provider-telemetry.jsonl");
  const lines = fs.existsSync(store) ? fs.readFileSync(store, "utf-8").trim().split("\n").filter(Boolean) : [];
  const rows = lines.map((l) => JSON.parse(l) as { provider: string; model: string; ci_pass: boolean; reverted: boolean; self_confidence?: number });
  const grouped = new Map<string, { provider: string; model: string; total: number; pass: number; reverted: number; calibration: number }>();
  for (const r of rows) {
    const k = `${r.provider}::${r.model}`;
    const current = grouped.get(k) ?? { provider: r.provider, model: r.model, total: 0, pass: 0, reverted: 0, calibration: 0 };
    current.total += 1;
    if (r.ci_pass) current.pass += 1;
    if (r.reverted) current.reverted += 1;
    current.calibration += Math.abs((r.self_confidence ?? 0.5) - (r.ci_pass ? 1 : 0));
    grouped.set(k, current);
  }
  const out = [...grouped.values()].map((g) => ({ provider: g.provider, model: g.model, pass_rate: g.total ? g.pass / g.total : 0, revert_ratio: g.total ? g.reverted / g.total : 0, calibration_score: g.total ? 1 - g.calibration / g.total : 0.5 }));
  fs.writeFileSync(path.join(outDir, "provider-matrix.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

if (cmd === "route") {
  const taskClass = flag("--task-class", "bugfix");
  const subsystem = flag("--subsystem", "core");
  const policy = JSON.parse(fs.readFileSync(path.join(root, "dgl/routing/policy.json"), "utf-8")) as { priors: Record<string, number>; providers: Array<{ provider: string; model: string; bias: number }> };
  const prior = policy.priors[taskClass] ?? 0.3;
  const scored = policy.providers.map((p) => ({ ...p, risk: Math.max(0.01, Math.min(0.99, prior + p.bias + (subsystem === "security" ? 0.15 : 0))) })).sort((a, b) => a.risk - b.risk);
  console.log(JSON.stringify({ task_class: taskClass, subsystem, recommended: scored[0], alternatives: scored.slice(1) }, null, 2));
  process.exit(0);
}

if (cmd === "openapi") {
  const baseSpec = flag("--base-spec", path.join(root, "dgl", "fixtures", "openapi", "base.json"));
  const headSpec = flag("--head-spec", path.join(root, "dgl", "fixtures", "openapi", "head-breaking.json"));
  const compat = compareOpenApi(baseSpec, headSpec, root);
  const p = path.join(outDir, "openapi_compat.json");
  fs.writeFileSync(p, JSON.stringify(compat, null, 2));
  console.log(JSON.stringify({ output: p, ...compat.summary }, null, 2));
  process.exit(compat.summary.breaking > 0 ? 1 : 0);
}


if (cmd === "run-export") {
  const id = flag("--id", "");
  if (!id) throw new Error("missing run id: use run-export --id <id> --zip <path>");
  const outZip = flag("--zip", path.join(root, "dgl", "exports", `${id}.zip`));
  const runFile = path.join(runsDir, `${id}.json`);
  const run = JSON.parse(fs.readFileSync(runFile, 'utf-8')) as { dgl_report_paths?: string[] };
  fs.mkdirSync(path.dirname(outZip), { recursive: true });
  const files = [...(run.dgl_report_paths ?? []), runFile].join(' ');
  execSync(`zip -j ${outZip} ${files}`);
  console.log(JSON.stringify({ zip: outZip }, null, 2));
  process.exit(0);
}


if (cmd === "run-list") {
  const runs = fs.readdirSync(runsDir).filter((f) => f.endsWith(".json")).sort();
  console.log(JSON.stringify(runs, null, 2));
  process.exit(0);
}

if (cmd === "run-show") {
  const id = flag("--id", args[1] ?? "");
  if (!id) throw new Error("missing run id: use run-show --id <id>");
  const run = path.join(runsDir, `${id}.json`);
  console.log(fs.readFileSync(run, "utf-8"));
  process.exit(0);
}
const report = scanDgl(base, head, changedOnly);
const jsonPath = path.join(outDir, "dgl_report.json");
const sarifPath = path.join(outDir, "dgl_report.sarif");
const mdPath = path.join(outDir, "dgl_report.md");
const writeStart = Date.now();
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(sarifPath, JSON.stringify(toSarif(report), null, 2));
fs.writeFileSync(mdPath, toMarkdown(report));
report.timings_ms = { ...(report.timings_ms ?? { language_scan: 0, intent: 0, openapi: 0, semantic: 0, trust_boundary: 0, report_write: 0 }), report_write: Date.now() - writeStart };
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
const runRecordPath = path.join(runsDir, `${report.run_id}.json`);
fs.writeFileSync(runRecordPath, JSON.stringify({
  run_id: report.run_id,
  timestamp: report.timestamp,
  repo: report.repo,
  base_sha: report.base_sha,
  head_sha: report.head_sha,
  dgl_report_paths: [jsonPath, mdPath, sarifPath],
  openapi_compat_summary: report.openapi_compat_summary,
  provider: report.provider ?? {},
  summary_scores: report.summary,
}, null, 2));

if (cmd === "gate") {
  const hasError = report.violations.some((v) => v.severity === "error");
  console.log(`DGL gate ${hasError ? "FAILED" : "PASSED"}. report=${jsonPath}`);
  process.exit(hasError ? 1 : 0);
}

console.log(JSON.stringify({ jsonPath, sarifPath, mdPath, runRecordPath, violations: report.violations.length, changed_only: changedOnly }, null, 2));
