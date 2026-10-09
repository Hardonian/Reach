#!/usr/bin/env npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

type Violation = { file: string; line: number; rule: string; snippet: string };

const ROOT = process.cwd();
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|go|rs)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'target',
]);

function collectFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (entry.isFile()) out.push(full);
  }
}

function listFiles(root: string): string[] {
  const abs = path.join(ROOT, root);
  if (!fs.existsSync(abs)) return [];
  if (!fs.statSync(abs).isDirectory())
    return [root].filter((f) => SRC_EXT.test(f));
  const out: string[] = [];
  collectFiles(abs, out);
  return out
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .filter((f) => SRC_EXT.test(f));
}

function toLines(file: string): string[] {
  return fs.readFileSync(file, 'utf8').split('\n');
}

function isMarketingSurface(file: string): boolean {
  if (!file.startsWith('apps/arcade/src/app/')) return false;
  const rel = file.replace('apps/arcade/src/app/', '');
  const excludedPrefixes = [
    'api/',
    'console/',
    'cloud/',
    'dashboard/',
    'studio/',
    'settings/',
    'governance/',
    'reports/',
    'decisions/',
    'demo/',
    'simulate/',
    'tools/',
    'playground/',
    'library/',
    'monitoring/',
    'marketplace/',
    'marketplace-alt/',
    'templates/',
    'share/',
  ];
  return !excludedPrefixes.some((prefix) => rel.startsWith(prefix));
}

const MARKETING_IMPORT_BLOCKLIST: RegExp[] = [
  /from\s+["']@\/lib\/runtime\/providers["']/,
  /from\s+["']@\/lib\/providers\//,
  /from\s+["']@\/lib\/cloud-auth["']/,
  /from\s+["']@\/lib\/env["']/,
  /from\s+["']@\/lib\/env\//,
  /from\s+["'][^"']*\/lib\/providers\//,
  /from\s+["'][^"']*\/lib\/runtime\/providers["']/,
  /from\s+["'][^"']*\/lib\/cloud-auth["']/,
  /from\s+["'][^"']*\/app\/api\/v1\/auth\//,
  /from\s+["']next-auth["']/,
  /from\s+["']@supabase\//,
  /from\s+["']@clerk\//,
  /from\s+["'][^"']*services\/billing\//,
  /from\s+["'][^"']*\/lib\/env["']/,
  /from\s+["'][^"']*\/lib\/env\//,
];

const DETERMINISM_RULES: Array<{
  root: string;
  patterns: Array<{ re: RegExp; rule: string }>;
}> = [
  {
    root: 'services/runner/internal/determinism',
    patterns: [
      {
        re: /\btime\.Now\s*\(/,
        rule: 'time.Now is forbidden in deterministic boundary',
      },
      { re: /\brand\./, rule: 'rand.* is forbidden in deterministic boundary' },
      {
        re: /\buuid\./i,
        rule: 'UUID generation is forbidden in deterministic boundary',
      },
      {
        re: /localeCompare\s*\(/,
        rule: 'localeCompare is forbidden in deterministic boundary',
      },
    ],
  },
  {
    root: 'services/runner/internal/jobs',
    patterns: [
      {
        re: /localeCompare\s*\(/,
        rule: 'localeCompare is forbidden in run pipeline boundaries',
      },
    ],
  },
  {
    root: 'crates/engine-core/src',
    patterns: [
      {
        re: /localeCompare\s*\(/,
        rule: 'localeCompare is forbidden in deterministic boundary',
      },
      {
        re: /SystemTime::now\s*\(/,
        rule: 'SystemTime::now is forbidden in deterministic boundary',
      },
      {
        re: /thread_rng\s*\(/,
        rule: 'thread_rng is forbidden in deterministic boundary',
      },
    ],
  },
];

function scanMarketingImports(): Violation[] {
  const files = listFiles('apps/arcade/src/app')
    .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f))
    .filter(isMarketingSurface);
  const violations: Violation[] = [];

  for (const file of files) {
    const lines = toLines(file);
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('//')) return;
      if (MARKETING_IMPORT_BLOCKLIST.some((re) => re.test(line))) {
        violations.push({
          file,
          line: i + 1,
          rule: 'marketing-import-boundary',
          snippet: line.trim(),
        });
      }
      const topLevelEnvThrow =
        /process\.env\./.test(line) && /throw\s+new\s+Error/.test(line);
      if (topLevelEnvThrow) {
        violations.push({
          file,
          line: i + 1,
          rule: 'marketing-import-time-env-throw',
          snippet: line.trim(),
        });
      }
    });
  }

  return violations;
}

function scanDeterminismBoundaries(): Violation[] {
  const violations: Violation[] = [];
  // Wall-clock timestamping is legitimate in CI-gate / reporting / self-test
  // tooling co-located with the determinism package; those files are not part
  // of the deterministic computation boundary. The core boundary files
  // (determinism.go, boundary.go, step.go, verify.go, ...) remain covered.
  const NON_DETERMINISTIC_TOOLING =
    /\/internal\/determinism\/(ci_gate|drift_report|selftest)\.go$/;
  for (const group of DETERMINISM_RULES) {
    const files = listFiles(group.root).filter(
      (f) =>
        !f.endsWith('_test.go') &&
        !f.includes('/tests/') &&
        !NON_DETERMINISTIC_TOOLING.test(f),
    );
    for (const file of files) {
      const lines = toLines(file);
      lines.forEach((line, i) => {
        if (
          line.trimStart().startsWith('//') ||
          line.trimStart().startsWith('*')
        )
          return;
        for (const pat of group.patterns) {
          if (pat.re.test(line)) {
            violations.push({
              file,
              line: i + 1,
              rule: pat.rule,
              snippet: line.trim(),
            });
          }
        }
      });
    }
  }
  return violations;
}

function printViolations(violations: Violation[]): void {
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.snippet}`);
  }
}

function main(): void {
  const marketingViolations = scanMarketingImports();
  const determinismViolations = scanDeterminismBoundaries();
  const all = [...marketingViolations, ...determinismViolations];

  if (all.length > 0) {
    console.error('boundary-dominance validation failed');
    printViolations(all);
    process.exit(1);
  }

  console.log('boundary-dominance validation passed');
}

main();
