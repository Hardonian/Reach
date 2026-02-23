#!/usr/bin/env node
/**
 * Junction to Decision Example Runner
 * 
 * Demonstrates creating a junction, evaluating options, and making a decision.
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const EXAMPLE_DIR = __dirname;

function log(...args) {
  console.log(...args);
}

function main() {
  log('=== Reach Example 03: Junction to Decision ===\n');

  // Load junction definition
  const junctionPath = resolve(EXAMPLE_DIR, 'junction.json');
  const policiesPath = resolve(EXAMPLE_DIR, 'policies.json');
  const tracePath = resolve(EXAMPLE_DIR, 'expected-trace.json');

  if (!existsSync(junctionPath)) {
    console.error('Junction file not found');
    process.exit(1);
  }

  const junction = JSON.parse(readFileSync(junctionPath, 'utf8'));
  const policies = JSON.parse(readFileSync(policiesPath, 'utf8'));
  const expectedTrace = JSON.parse(readFileSync(tracePath, 'utf8'));

  // Display junction
  log(`Junction: ${junction.name}`);
  log(`Description: ${junction.description}`);
  log(`Context: ${junction.context.service} v${junction.context.current_version} → v${junction.context.target_version}`);
  log();

  // Display options
  log('--- Options ---');
  junction.options.forEach((opt, i) => {
    log(`${i + 1}. ${opt.name} (confidence: ${opt.confidence})`);
    log(`   ${opt.description}`);
    log(`   Evidence items: ${opt.evidence.length}`);
    log(`   Cost: ${opt.constraints.infrastructure_cost}, Rollback: ${opt.constraints.rollback_time}`);
    log();
  });

  // Display policies
  log('--- Policies ---');
  policies.policies.forEach(p => {
    const icon = p.severity === 'blocking' ? '🔴' : p.severity === 'warning' ? '🟡' : '🟢';
    log(`${icon} ${p.id}: ${p.description}`);
    log(`   Rule: ${p.rule.field} ${p.rule.operator} ${JSON.stringify(p.rule.value)}`);
    log();
  });

  // Show evaluation
  log('--- Evaluation ---');
  junction.options.forEach(opt => {
    const passesMinConf = opt.confidence >= junction.selection_criteria.minimum_confidence;
    const passesRollback = ['instant', 'fast'].includes(opt.constraints.rollback_time);
    const overall = passesMinConf && passesRollback ? '✅ PASS' : '❌ FAIL';
    
    log(`${opt.id}: ${overall}`);
    log(`  Confidence check: ${passesMinConf ? '✓' : '✗'} (${opt.confidence} >= ${junction.selection_criteria.minimum_confidence})`);
    log(`  Rollback check: ${passesRollback ? '✓' : '✗'} (${opt.constraints.rollback_time})`);
    log();
  });

  // Show expected decision
  log('--- Expected Decision ---');
  log(`Selected: ${expectedTrace.expected_selection.option_id}`);
  log(`Rationale: ${expectedTrace.expected_selection.rationale}`);
  log();
  log('Rejected options:');
  expectedTrace.expected_selection.rejected_options.forEach(r => {
    log(`  - ${r.id}: ${r.reason}`);
  });
  log();

  // Show trace structure
  log('--- Decision Trace ---');
  expectedTrace.trace_structure.steps.forEach((step, i) => {
    log(`${i + 1}. ${step.phase}`);
    log(`   Data: ${JSON.stringify(step.data)}`);
  });
  log();

  log('✅ Demo complete!');
  log('\nNext: examples/04-action-plan-execute-safe/');
}

if (require.main === module) {
  main();
}

module.exports = { main };
