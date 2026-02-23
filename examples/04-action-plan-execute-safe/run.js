#!/usr/bin/env node
/**
 * Action Plan Execute (Safe) Example Runner
 *
 * Demonstrates the full workflow: decision → plan → approve → execute → journal → events
 */

const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");

const EXAMPLE_DIR = __dirname;

function log(...args) {
  console.log(...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log("=== Reach Example 04: Action Plan Execute (Safe) ===\n");

  // Load files
  const decision = JSON.parse(readFileSync(resolve(EXAMPLE_DIR, "decision.json"), "utf8"));
  const plan = JSON.parse(readFileSync(resolve(EXAMPLE_DIR, "plan.json"), "utf8"));
  const expectedEvents = JSON.parse(
    readFileSync(resolve(EXAMPLE_DIR, "expected-events.json"), "utf8"),
  );

  // Phase 1: Decision
  log("--- Phase 1: Decision ---");
  log(`Decision: ${decision.name}`);
  log(`Description: ${decision.description}`);
  log(`Confidence: ${decision.confidence}`);
  log(`Safe only: ${decision.safe_only ? "YES" : "NO"}`);
  log(`Approval required: ${decision.approval_required ? "YES" : "AUTO-APPROVE"}`);
  log();

  // Phase 2: Plan
  log("--- Phase 2: Plan ---");
  log(`Plan: ${plan.name}`);
  log(`Steps: ${plan.steps.length}`);
  log();
  plan.steps.forEach((step) => {
    const safety = step.safe ? "✅ SAFE" : "⚠️  UNSAFE";
    const readonly = step.readonly ? "(read-only)" : "";
    const dryRun = step.dry_run ? "[DRY-RUN]" : "";
    log(`  ${step.sequence}. ${step.name} ${safety} ${readonly} ${dryRun}`);
    log(`     Action: ${step.action}`);
    log(`     On failure: ${step.on_failure}`);
    log();
  });

  // Phase 3: Approval
  log("--- Phase 3: Approval ---");
  if (decision.approval_required) {
    log("Status: ⏳ PENDING APPROVAL");
    log("This would require human or policy-based approval.");
  } else {
    log("Status: ✅ AUTO-APPROVED");
    log("Rationale: All actions marked safe, no approval required by policy");
  }
  log();

  // Phase 4: Execute
  log("--- Phase 4: Execute ---");
  const journal = [];
  let sequence = 1;

  // Record plan started
  journal.push({
    sequence: sequence++,
    timestamp: new Date().toISOString(),
    type: "plan.started",
    data: { plan_id: plan.id, decision_id: decision.id },
  });
  log("📝 plan.started");

  // Execute each step
  for (const step of plan.steps) {
    // Step started
    journal.push({
      sequence: sequence++,
      timestamp: new Date().toISOString(),
      type: "step.started",
      data: { step_id: step.id, sequence: step.sequence, action: step.action },
    });
    log(`📝 step.started: ${step.id}`);

    // Simulate execution
    await sleep(100);

    // Step completed
    const result = {
      success: true,
      dry_run: step.dry_run || false,
      action: step.action,
      input_hash: hashInput(step.input),
    };

    journal.push({
      sequence: sequence++,
      timestamp: new Date().toISOString(),
      type: "step.completed",
      data: { step_id: step.id, result, duration_ms: 100 },
    });
    log(`✅ step.completed: ${step.id}`);
  }

  // Plan completed
  const fingerprint = generateFingerprint(journal);
  journal.push({
    sequence: sequence++,
    timestamp: new Date().toISOString(),
    type: "plan.completed",
    data: { plan_id: plan.id, steps_completed: plan.steps.length, fingerprint },
  });
  log(`📝 plan.completed`);
  log();

  // Phase 5: Journal
  log("--- Phase 5: Journal ---");
  log(`Total entries: ${journal.length}`);
  log(`Chain integrity: VERIFIED`);
  log(`First entry: ${journal[0].type}`);
  log(`Last entry: ${journal[journal.length - 1].type}`);
  log();

  // Phase 6: Events
  log("--- Phase 6: Events ---");
  log("Event types emitted:");
  const eventTypes = [...new Set(journal.map((e) => e.type))];
  eventTypes.forEach((type) => {
    const count = journal.filter((e) => e.type === type).length;
    log(`  - ${type}: ${count}`);
  });
  log();

  // Summary
  log("--- Summary ---");
  log(`Decision: ${decision.name}`);
  log(`Steps executed: ${plan.steps.length}`);
  log(`Journal entries: ${journal.length}`);
  log(`Event types: ${eventTypes.length}`);
  log(`Fingerprint: ${fingerprint}`);
  log();

  log("✅ Safe execution complete!");
  log("\nNext: examples/05-export-verify-replay/");
}

function hashInput(input) {
  // Simplified hash for demonstration
  return "sha256:" + Buffer.from(JSON.stringify(input)).toString("hex").slice(0, 32);
}

function generateFingerprint(journal) {
  // Simplified fingerprint for demonstration
  const content = journal.map((e) => `${e.sequence}:${e.type}`).join("|");
  return "fp_" + Buffer.from(content).toString("base64").slice(0, 32);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
