#!/usr/bin/env node
/**
 * Fresh Install Verification
 * 
 * Simulates a clean checkout → install → smoke test pipeline
 * to ensure the repository is installable from scratch.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(step, message) {
  console.log(`${colors.blue}[${step}]${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function warn(message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function error(message) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function run(command, options = {}) {
  try {
    return execSync(command, {
      cwd: projectRoot,
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options,
    });
  } catch (e) {
    if (options.fallback) {
      return options.fallback;
    }
    throw e;
  }
}

// =============================================================================
// Verification Steps
// =============================================================================

let exitCode = 0;

try {
  log('1/7', 'Checking prerequisites...');
  
  // Check Node.js
  const nodeVersion = run('node --version', { silent: true }).trim();
  if (nodeVersion) {
    success(`Node.js ${nodeVersion}`);
  } else {
    error('Node.js not found');
    exitCode = 1;
  }

  // Check pnpm
  try {
    const pnpmVersion = run('pnpm --version', { silent: true }).trim();
    success(`pnpm ${pnpmVersion}`);
  } catch {
    error('pnpm not found - install with: npm install -g pnpm');
    exitCode = 1;
  }

  log('2/7', 'Checking lockfile...');
  const hasPnpmLock = existsSync(join(projectRoot, 'pnpm-lock.yaml'));
  const hasNpmLock = existsSync(join(projectRoot, 'package-lock.json'));
  
  if (hasPnpmLock) {
    success('pnpm-lock.yaml found');
  } else if (hasNpmLock) {
    warn('Using package-lock.json (pnpm preferred)');
  } else {
    warn('No lockfile found - will use fresh install');
  }

  log('3/7', 'Installing dependencies...');
  try {
    if (hasPnpmLock) {
      run('pnpm install --frozen-lockfile');
    } else {
      run('pnpm install');
    }
    success('Dependencies installed');
  } catch (e) {
    error(`Install failed: ${e.message}`);
    exitCode = 1;
  }

  log('4/7', 'Running type check...');
  try {
    run('pnpm run typecheck', { silent: true });
    success('TypeScript type check passed');
  } catch (e) {
    error('Type check failed');
    exitCode = 1;
  }

  log('5/7', 'Running lint...');
  try {
    run('pnpm run lint', { silent: true });
    success('Lint passed');
  } catch (e) {
    warn('Lint has warnings (non-fatal)');
  }

  log('6/7', 'Running unit tests...');
  try {
    run('pnpm run test:unit', { silent: true });
    success('Unit tests passed');
  } catch (e) {
    error('Unit tests failed');
    exitCode = 1;
  }

  log('7/7', 'Running protocol tests...');
  try {
    run('pnpm run test:protocol', { silent: true });
    success('Protocol tests passed');
  } catch (e) {
    error('Protocol tests failed');
    exitCode = 1;
  }

  console.log('');
  if (exitCode === 0) {
    console.log(`${colors.green}========================================${colors.reset}`);
    console.log(`${colors.green}  Fresh install verification: PASSED   ${colors.reset}`);
    console.log(`${colors.green}========================================${colors.reset}`);
  } else {
    console.log(`${colors.red}========================================${colors.reset}`);
    console.log(`${colors.red}  Fresh install verification: FAILED    ${colors.reset}`);
    console.log(`${colors.red}========================================${colors.reset}`);
  }
} catch (e) {
  error(`Unexpected error: ${e.message}`);
  exitCode = 1;
}

process.exit(exitCode);
