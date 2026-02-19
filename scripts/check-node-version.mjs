#!/usr/bin/env node
/**
 * Pre-install hook to check Node.js version compatibility
 * Fails in CI if Node version is outside supported range
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json manually to avoid import assertion issues
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const version = packageJson.engines.node;
const currentVersion = process.version;

// Parse version requirements
const [minVersion, maxVersion] = version.replace('>=', '').replace('<', '').split(' ').filter(Boolean);

// Extract major version numbers
const currentMajor = parseInt(currentVersion.replace('v', '').split('.')[0]);
const minMajor = parseInt(minVersion?.split('.')[0] || '0');
const maxMajor = parseInt(maxVersion?.split('.')[0] || '99');

console.log(`Node.js version check: ${currentVersion} (required: ${version})`);

if (currentMajor < minMajor || currentMajor >= maxMajor) {
  console.error(`\n❌ Unsupported Node.js version: ${currentVersion}`);
  console.error(`   Required: Node.js ${version}`);
  console.error(`   Please upgrade or use a Node version manager (nvm, n, etc.)\n`);
  
  // Fail in CI, warn locally
  if (process.env.CI) {
    process.exit(1);
  } else {
    console.warn('⚠️  Continuing anyway (not in CI environment)...\n');
  }
} else {
  console.log(`✅ Node.js version ${currentVersion} is supported\n`);
}
