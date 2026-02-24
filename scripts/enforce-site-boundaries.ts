import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'apps', 'arcade', 'src');

const OSS_PREFIXES = ['app/docs/', 'app/gallery/', 'app/download/', 'app/security/', 'app/whitepaper/', 'app/roadmap/'];
const ENTERPRISE_PREFIXES = ['app/enterprise/', 'app/contact/'];
const SHARED_ALLOWLIST = ['packages/ui/', 'packages/content/'];

interface Violation { file: string; line: number; rule: string; specifier: string }

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile() && /\.(tsx?|jsx?)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/');
}

function classify(rel: string): 'oss' | 'enterprise' | 'shared' | 'neutral' {
  if (OSS_PREFIXES.some((p) => rel.startsWith(p))) return 'oss';
  if (ENTERPRISE_PREFIXES.some((p) => rel.startsWith(p))) return 'enterprise';
  if (SHARED_ALLOWLIST.some((p) => rel.startsWith(p))) return 'shared';
  return 'neutral';
}

function resolveSpecifier(file: string, spec: string): string {
  if (spec.startsWith('@/')) return normalize(path.relative(repoRoot, path.join(appRoot, spec.slice(2))));
  if (spec.startsWith('.')) return normalize(path.relative(repoRoot, path.resolve(path.dirname(file), spec)));
  return spec;
}

const importPattern = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
const files = walk(appRoot);
const violations: Violation[] = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const relFile = normalize(path.relative(path.join(repoRoot, 'apps', 'arcade', 'src'), file));
  const sourceClass = classify(relFile);

  for (const m of text.matchAll(importPattern)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    const resolved = resolveSpecifier(file, spec);

    if (resolved.startsWith('node:') || resolved.startsWith('react') || resolved.startsWith('next')) continue;
    if (SHARED_ALLOWLIST.some((p) => resolved.startsWith(p))) continue;

    const targetClass = classify(resolved.replace(/^src\//, ''));

    if (sourceClass === 'oss' && targetClass === 'enterprise') {
      const line = text.slice(0, m.index ?? 0).split('\n').length;
      violations.push({ file: `apps/arcade/src/${relFile}`, line, rule: 'OSS_CANNOT_IMPORT_ENTERPRISE', specifier: spec });
    }
    if (sourceClass === 'enterprise' && targetClass === 'oss') {
      const line = text.slice(0, m.index ?? 0).split('\n').length;
      violations.push({ file: `apps/arcade/src/${relFile}`, line, rule: 'ENTERPRISE_CANNOT_IMPORT_OSS', specifier: spec });
    }
  }
}

if (violations.length) {
  console.error(`enforce-site-boundaries: found ${violations.length} violation(s).`);
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} [${v.rule}] import '${v.specifier}'`);
  }
  process.exit(1);
}

console.log('enforce-site-boundaries: no cross-site import violations found.');
