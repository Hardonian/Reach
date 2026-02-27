#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ESSENTIAL_ROOT_FILES = new Set([
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'Cargo.toml',
  'Cargo.lock',
  'go.work',
  'go.work.sum',
  'Makefile',
  '.gitignore',
  '.env.example',
  '.eslintrc.js',
  'eslint.config.js',
  'tsconfig.json',
  'tsconfig.build.json',
  'tsconfig.exports.json',
  'vitest.config.ts',
  'rust-toolchain.toml',
  'Dockerfile',
  'Dockerfile.dev',
  'docker-compose.yml',
  'docker-compose.dev.yml',
  'NOTICE',
  'VERSION',
  'vercel.json',
  'tsconfig.tsbuildinfo',
  'tsconfig.build.tsbuildinfo',
  'VERIFY_CPX.md',
  'VERIFY_DGL.md'
]);

const ALLOWED_ROOT_DIRS = new Set([
  '.agent', '.artifacts', '.cargo', '.github', '.git', '.kilocode',
  'agents', 'apps', 'ARTIFACTS', 'compat', 'config', 'contracts', 'crates',
  'data', 'dgl', 'docs', 'internal', 'packages', 'protocol', 'scripts',
  'services', 'spec', 'src', 'stitch_exports', 'support', 'templates',
  'test', 'testdata', 'tests', 'tools', 'design', 'docker', 'examples',
  'extensions', 'fixtures', 'integrations', 'logs', 'mobile', 'openapi',
  'pack-devkit', 'packs', 'plans', 'plugins', 'policies', 'prompts',
  'providers', 'sdk'
]);

// Legacy root-level sources and formal specs kept for compatibility.
const LEGACY_ALLOWED_ROOT_FILES = new Set([
  'fallback.js', 'fallback.d.ts',  // Compatibility stubs for integration tests
  'validation.ts', 'cspell.json',  // Development tooling
  'ADAPTIVE_ENGINE_SPEC.md', 'ARCHITECTURE.md', 'AUDIT_REPORT.md', 'AUTOPACK_SPEC.md',
  'CAPABILITY_REGISTRY.md', 'CAPABILITY_SYSTEM.md', 'CLOUD_ADAPTER_MODEL.md',
  'DOCS_DRIFT_GUARD.md', 'EXECUTION_PACK_SPEC.md', 'EXECUTION_PROTOCOL.md',
  'FEDERATED_EXECUTION_SPEC.md', 'GAP_LIST.md', 'GOVERNANCE.md', 'GRAPH_EXECUTION_SPEC.md',
  'IMPORT_RULES.md', 'KIP.md', 'LAUNCHKIT.md', 'MOBILE_MILESTONE_SUMMARY.md',
  'MODEL_ROUTING_SPEC.md', 'MODEL_SPEC.md', 'OSS_BUILD_GUARANTEE.md', 'PLUGIN_SIGNING.md',
  'READY_LAYER_STRATEGY.md', 'RELEASE.md', 'RUN_CAPSULES_REPLAY.md', 'SECURITY_HARDENING_REPORT.md',
  'SECURITY_MODEL.md', 'SKILLS.md', 'SPEC_FORMALIZATION_SUMMARY.md', 'SUPPORT.md',
  'TRUST_NEGOTIATION_SPEC.md',
  'brand.test.ts', 'config.go', 'decide-cli.ts', 'engine.rs', 'fallback.ts.deprecated', 'index.ts',
  'json_test.go', 'junctions-cli.ts', 'lib.rs', 'main.go', 'oss_workflow_test.go', 'parity.js',
  'parser.test.ts', 'parser.ts', 'reach', 'reach-policy.txt', 'reach-to-readylayer.patch',
  'reach.workspace.json', 'storage.go', 'types.rs', 'validate-cli.ts', 'doctor-validation.yml'
]);

const BLOCKED_PATTERNS = [
  /^tsc_errors.*\.txt$/,
  /^typecheck_output.*\.txt$/,
  /^docs_index_check_output\.txt$/,
  /^.*\.tmp$/,
  /^.*\.bak$/,
  /^.*\.orig$/
];

const entries = readdirSync(process.cwd()).sort();
const violations = [];

for (const name of entries) {
  if (name === 'node_modules' || name === '.DS_Store') continue;

  if (BLOCKED_PATTERNS.some((p) => p.test(name))) {
    violations.push(`Blocked generated artifact in root: ${name}`);
    continue;
  }

  const full = path.join(process.cwd(), name);
  const isDir = statSync(full).isDirectory();

  if (isDir) {
    if (!ALLOWED_ROOT_DIRS.has(name)) {
      violations.push(`Unexpected root directory: ${name}`);
    }
    continue;
  }

  if (!ESSENTIAL_ROOT_FILES.has(name) && !LEGACY_ALLOWED_ROOT_FILES.has(name)) {
    violations.push(`Unexpected root file: ${name}`);
  }
}

if (violations.length) {
  console.error('verify:root failed. Root contains non-allowlisted entries:');
  for (const item of violations) console.error(` - ${item}`);
  process.exit(1);
}

console.log('verify:root passed. Root structure matches allowlist and no generated artifacts were found.');
