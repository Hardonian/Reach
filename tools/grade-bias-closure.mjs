#!/usr/bin/env node

import fs from "node:fs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node tools/grade-bias-closure.mjs <scorecard.json>");
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Scorecard not found: ${inputPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, "utf8");
let scorecard;
try {
  scorecard = JSON.parse(raw);
} catch (err) {
  console.error(`Invalid JSON: ${err.message}`);
  process.exit(1);
}

const ITEMS = {
  route_nav_integrity: { weight: 10, section: "P0", p0: true },
  api_key_lifecycle_ui: { weight: 10, section: "P0", p0: true },
  audit_workflow_ui: { weight: 10, section: "P0", p0: true },
  what_failed_explainer: { weight: 10, section: "P0", p0: true },
  policy_gate_rollback: { weight: 10, section: "P0", p0: true },
  ownership_metadata: { weight: 10, section: "P0", p0: true },
  identity_claims_parity: { weight: 8, section: "Trust", p0: false },
  enterprise_analytics_ui: { weight: 4, section: "Trust", p0: false },
  compliance_export_bundle: { weight: 8, section: "Trust", p0: false },
  trace_explorer_live: { weight: 5, section: "Ops", p0: false },
  integration_setup_wizard: { weight: 4, section: "Ops", p0: false },
  alert_delivery_ledger: { weight: 4, section: "Ops", p0: false },
  onboarding_server_persistence: { weight: 3, section: "Ops", p0: false },
  executive_reporting: { weight: 4, section: "Ops", p0: false }
};

const REQUIRED_COMMANDS = [
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run build",
  "npm run verify:routes",
  "npm run verify:oss",
  "npm run verify:boundaries"
];

function normalizeStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hasEvidence(item) {
  const paths = Array.isArray(item?.evidence_paths) ? item.evidence_paths : [];
  const checks = Array.isArray(item?.verification_steps) ? item.verification_steps : [];
  return paths.length > 0 && checks.length > 0;
}

function statusFactor(itemKey, status) {
  const s = normalizeStatus(status);
  if (s === "shipped") return 1;
  if (s === "partially shipped") return 0.5;
  if (s === "blocked") return 0;
  if (s === "claim downgraded") return itemKey === "identity_claims_parity" ? 1 : 0;
  return 0;
}

const closures = scorecard.closures ?? {};
let total = 0;
const rows = [];

for (const [key, def] of Object.entries(ITEMS)) {
  const item = closures[key] ?? { status: "Blocked" };
  const evidenceOk = hasEvidence(item);
  const factor = evidenceOk ? statusFactor(key, item.status) : 0;
  const points = def.weight * factor;
  total += points;
  rows.push({
    key,
    status: item.status ?? "Blocked",
    evidenceOk,
    weight: def.weight,
    points
  });
}

const failures = [];

if (!scorecard.integrity_assertions?.determinism_semantics_unchanged) {
  failures.push("Hard gate failed: determinism_semantics_unchanged is false.");
}

const verification = Array.isArray(scorecard.verification) ? scorecard.verification : [];
for (const cmd of REQUIRED_COMMANDS) {
  const hit = verification.find((v) => String(v.command).trim() === cmd);
  if (!hit || normalizeStatus(hit.status) !== "pass") {
    failures.push(`Hard gate failed: verification command did not pass -> ${cmd}`);
  }
}

const smokeRoutes = Array.isArray(scorecard.smoke_routes) ? scorecard.smoke_routes : [];
if (smokeRoutes.length === 0) {
  failures.push("Hard gate failed: no smoke_routes provided.");
} else {
  for (const route of smokeRoutes) {
    const code = Number(route.status_code ?? 0);
    if (!Number.isFinite(code) || code >= 500 || code < 100) {
      failures.push(`Hard gate failed: smoke route returned invalid/5xx (${route.path}: ${route.status_code}).`);
    }
  }
}

for (const [key, def] of Object.entries(ITEMS)) {
  if (!def.p0) continue;
  const item = closures[key] ?? { status: "Blocked" };
  if (normalizeStatus(item.status) !== "shipped" || !hasEvidence(item)) {
    failures.push(`Hard gate failed: P0 item not fully shipped with evidence -> ${key}`);
  }
}

const rounded = Math.round(total * 100) / 100;
let verdict;
if (failures.length > 0) {
  verdict = "RED";
} else if (rounded >= 85) {
  verdict = "GREEN";
} else if (rounded >= 70) {
  verdict = "YELLOW";
} else {
  verdict = "RED";
}

console.log("\nReach Bias Closure Scorecard");
console.log("============================");
console.log(`Input: ${inputPath}`);
console.log(`Score: ${rounded}/100`);
console.log(`Verdict: ${verdict}`);

console.log("\nItem Scores:");
for (const row of rows) {
  console.log(`- ${row.key}: ${row.points}/${row.weight} | status=${row.status} | evidence=${row.evidenceOk ? "ok" : "missing"}`);
}

if (failures.length > 0) {
  console.log("\nHard Gate Failures:");
  for (const f of failures) {
    console.log(`- ${f}`);
  }
}

const output = {
  input: inputPath,
  score: rounded,
  verdict,
  hard_gate_failures: failures,
  items: rows
};

console.log("\nJSON Summary:");
console.log(JSON.stringify(output, null, 2));
