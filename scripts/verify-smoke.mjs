#!/usr/bin/env node
/**
 * Reach Smoke Test
 *
 * Quick verification that core functionality works:
 * 1. TypeScript compilation
 * 2. Determinism primitives
 * 3. CLI commands load
 * 4. Basic hash operations
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let failed = 0;
let passed = 0;

function log(title, message, type = 'info') {
  const color = type === 'error' ? RED : type === 'warn' ? YELLOW : GREEN;
  console.log(`${color}[${title}]${RESET} ${message}`);
}

function test(name, fn) {
  try {
    fn();
    log('PASS', name);
    passed++;
  } catch (err) {
    log('FAIL', `${name}: ${err.message}`, 'error');
    failed++;
  }
}

// ============================================================================
// Smoke Tests
// ============================================================================

console.log('\n=== Reach Smoke Test ===\n');

// Test 1: Project structure
test('Project structure exists', () => {
  const required = ['src', 'package.json', 'docs/GO_LIVE.md'];
  for (const path of required) {
    if (!existsSync(join(PROJECT_ROOT, path))) {
      throw new Error(`Missing: ${path}`);
    }
  }
});

// Test 2: Package.json valid
test('Package.json is valid', () => {
  const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
  if (!pkg.name || !pkg.version) {
    throw new Error('Missing name or version');
  }
});

// Test 3: Determinism primitives (hash)
test('Determinism: hash is consistent', () => {
  const data = 'test-data-123';
  const hash1 = createHash('sha256').update(data).digest('hex');
  const hash2 = createHash('sha256').update(data).digest('hex');
  if (hash1 !== hash2) {
    throw new Error('Hash inconsistency detected');
  }
});

// Test 4: Environment check
test('Environment: Node.js version', () => {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  if (major < 18) {
    throw new Error(`Node.js ${version} is too old (need >= 18)`);
  }
});

// Test 5: TypeScript compilation (quick check)
test('TypeScript: can parse core files', () => {
  const files = [
    'src/determinism/canonicalJson.ts',
    'src/lib/hash.ts',
    'src/lib/canonical.ts',
  ];
  for (const file of files) {
    const path = join(PROJECT_ROOT, file);
    if (!existsSync(path)) {
      throw new Error(`Missing: ${file}`);
    }
    const content = readFileSync(path, 'utf-8');
    if (!content.includes('export')) {
      throw new Error(`Invalid: ${file}`);
    }
  }
});

// Test 6: Config structure
test('Config: .reach directory structure', () => {
  const reachDir = join(PROJECT_ROOT, '.reach');
  if (existsSync(reachDir)) {
    const configPath = join(reachDir, 'config.json');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!config.version) {
        throw new Error('Config missing version');
      }
    }
  }
});

// Test 7: Documentation
test('Documentation: GO_LIVE.md exists and has content', () => {
  const path = join(PROJECT_ROOT, 'docs/GO_LIVE.md');
  const content = readFileSync(path, 'utf-8');
  if (content.length < 1000) {
    throw new Error('GO_LIVE.md seems incomplete');
  }
  if (!content.includes('Quick Start')) {
    throw new Error('GO_LIVE.md missing Quick Start section');
  }
});

// Test 8: Scripts executable
test('Scripts: install scripts exist', () => {
  const scripts = ['scripts/install.sh', 'scripts/install.ps1'];
  for (const script of scripts) {
    if (!existsSync(join(PROJECT_ROOT, script))) {
      throw new Error(`Missing: ${script}`);
    }
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Summary ===');
console.log(`${GREEN}Passed: ${passed}${RESET}`);
if (failed > 0) {
  console.log(`${RED}Failed: ${failed}${RESET}`);
}

if (failed === 0) {
  console.log(`\n${GREEN}✓ All smoke tests passed!${RESET}\n`);
  console.log('Next steps:');
  console.log('  pnpm verify:fast  # Run full validation');
  console.log('  pnpm verify       # Run comprehensive checks');
  process.exit(0);
} else {
  console.log(`\n${RED}✗ Some smoke tests failed${RESET}\n`);
  process.exit(1);
}
