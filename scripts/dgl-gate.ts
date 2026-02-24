#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { scanDgl, toMarkdown, toSarif, computeIntentFingerprint } from "../src/dgl/index.js";

const args = process.argv.slice(2);
const cmd = args[0] || "scan";
const flag = (name: string, fallback = "") => {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : fallback;
};
const git = (c: string) => execSync(`git ${c}`, { encoding: "utf-8" }).trim();
const base = flag("--base", git("rev-parse HEAD~1"));
const head = flag("--head", git("rev-parse HEAD"));

const outDir = path.join(process.cwd(), "dgl", "reports");
fs.mkdirSync(outDir, { recursive: true });

if (cmd === "intent") {
  const fp = computeIntentFingerprint(path.join(process.cwd(), "docs/architecture/intent-manifest.json"));
  console.log(JSON.stringify({ fingerprint: fp }, null, 2));
  process.exit(0);
}

if (cmd === "baseline" && args.includes("--intent")) {
  const branch = git("rev-parse --abbrev-ref HEAD").replace(/\//g, "_");
  const fp = computeIntentFingerprint(path.join(process.cwd(), "docs/architecture/intent-manifest.json"));
  const target = path.join(process.cwd(), "dgl/baselines/intent", `${branch}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ branch, fingerprint: fp, updated_at: new Date().toISOString() }, null, 2));
  console.log(`intent baseline updated: ${target}`);
  process.exit(0);
}

if (cmd === "provider-matrix") {
  const store = path.join(process.cwd(), "dgl", "provider-telemetry.jsonl");
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
  const policy = JSON.parse(fs.readFileSync(path.join(process.cwd(), "dgl/routing/policy.json"), "utf-8")) as { priors: Record<string, number>; providers: Array<{ provider: string; model: string; bias: number }> };
  const prior = policy.priors[taskClass] ?? 0.3;
  const scored = policy.providers.map((p) => ({ ...p, risk: Math.max(0.01, Math.min(0.99, prior + p.bias + (subsystem === "security" ? 0.15 : 0))) })).sort((a,b)=>a.risk-b.risk);
  console.log(JSON.stringify({ task_class: taskClass, subsystem, recommended: scored[0], alternatives: scored.slice(1) }, null, 2));
  process.exit(0);
}

const report = scanDgl(base, head);
const jsonPath = path.join(outDir, "dgl_report.json");
const sarifPath = path.join(outDir, "dgl_report.sarif");
const mdPath = path.join(outDir, "dgl_report.md");
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(sarifPath, JSON.stringify(toSarif(report), null, 2));
fs.writeFileSync(mdPath, toMarkdown(report));

if (cmd === "gate") {
  const hasError = report.violations.some((v) => v.severity === "error");
  console.log(`DGL gate ${hasError ? "FAILED" : "PASSED"}. report=${jsonPath}`);
  process.exit(hasError ? 1 : 0);
}

console.log(JSON.stringify({ jsonPath, sarifPath, mdPath, violations: report.violations.length }, null, 2));
