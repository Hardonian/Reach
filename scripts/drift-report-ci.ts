import { spawnSync } from "node:child_process";

/**
 * CI Guardrail: Automates 'zeo drift-report' to catch behavioral shifts
 * that bypass bit-level determinism checks but alter decision outcomes.
 */

console.log("================================================================");
console.log("AUTOMATED DRIFT REPORT (CI GATE)");
console.log("================================================================");

const res = spawnSync(
  "node",
  ["--import", "tsx/esm", "src/cli/workflow-cli.ts", "drift-report", "--since", "30d", "--json"],
  { encoding: "utf8" },
);

if (res.status !== 0) {
  // If it's a "no workspaces" error, it's not a failure for CI in some cases,
  // but if the command itself crashed, it is.
  if (res.stderr.includes("not found") || res.stderr.includes("no workspaces")) {
    console.log("No workspaces found. Skipping drift report.");
    process.exit(0);
  }
  console.error("❌ Drift report command failed:");
  console.error(res.stderr);
  process.exit(1);
}

try {
  const output = JSON.parse(res.stdout);
  const driftCount = Array.isArray(output) ? output.length : 0;

  if (driftCount > 0) {
    console.error(`❌ DRIFT DETECTED: ${driftCount} decision(s) show behavioral instability.`);
    console.error(JSON.stringify(output, null, 2));
    process.exit(1);
  } else {
    console.log("✅ No behavioral drift detected in active decision workspaces.");
  }
} catch (e) {
  console.error("❌ Failed to parse drift report output as JSON.");
  console.error("Output received:", res.stdout);
  process.exit(1);
}
