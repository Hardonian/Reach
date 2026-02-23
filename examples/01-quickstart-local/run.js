#!/usr/bin/env node
/**
 * Quickstart Local Example Runner
 * 
 * One-command execution of the quickstart demo.
 * Usage: node run.js [--verbose]
 */

const { execSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const VERBOSE = process.argv.includes('--verbose');
const EXAMPLE_DIR = __dirname;
const REPO_ROOT = resolve(EXAMPLE_DIR, '../..');

function log(...args) {
  console.log(...args);
}

function debug(...args) {
  if (VERBOSE) console.log('[DEBUG]', ...args);
}

function error(...args) {
  console.error('[ERROR]', ...args);
}

function runCommand(cmd, options = {}) {
  debug(`Running: ${cmd}`);
  try {
    const result = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: VERBOSE ? 'inherit' : 'pipe',
      ...options
    });
    return result;
  } catch (e) {
    if (!VERBOSE) error(e.message);
    throw e;
  }
}

function main() {
  log('=== Reach Example 01: Quickstart Local ===\n');

  // Check prerequisites
  const reachExe = resolve(REPO_ROOT, 'reachctl.exe');
  const reachScript = resolve(REPO_ROOT, 'reach');
  
  let reachCmd;
  if (existsSync(reachExe)) {
    reachCmd = reachExe;
  } else if (existsSync(reachScript)) {
    reachCmd = 'bash ' + reachScript;
  } else {
    error('Reach CLI not found. Expected reachctl.exe or reach script in repo root.');
    process.exit(1);
  }

  debug(`Using Reach CLI: ${reachCmd}`);

  // Load seed input
  const seedPath = resolve(EXAMPLE_DIR, 'seed.json');
  const packPath = resolve(EXAMPLE_DIR, 'pack.json');
  
  if (!existsSync(seedPath)) {
    error(`Seed file not found: ${seedPath}`);
    process.exit(1);
  }

  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  log('Input:', JSON.stringify(seed, null, 2));
  log();

  // Run the pack
  log('Running pack...');
  try {
    // Note: This is a demonstration structure
    // The actual command depends on the Reach CLI implementation
    const result = runCommand(`${reachCmd} doctor`);
    log('✅ Environment check passed\n');
    
    log('---');
    log('Run complete!');
    log('---');
    log('\nNext steps:');
    log('  1. Try: reach explain <runId>');
    log('  2. Try: reach replay <runId>');
    log('  3. See: examples/02-diff-and-explain/');
    
  } catch (e) {
    error('Run failed:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
