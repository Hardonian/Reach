import fs from 'node:fs';
import path from 'node:path';

type Violation = { file: string; line: number; rule: string; text: string };

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, 'apps', 'arcade', 'src', 'app');

const ENTERPRISE_ONLY_TERMS = [
  /\bSLA\b/i,
  /\bSOC\s*2\b/i,
  /\bSSO\b/i,
  /\bSCIM\b/i,
  /managed control plane/i,
  /tenant isolation dashboard/i,
  /enterprise support contract/i,
];

const ROADMAP_REQUIRED_TERMS = [/\broadmap\b/i, /\bstub\b/i, /\bbeta\b/i, /\bplanned\b/i, /not yet available/i];
const ENTERPRISE_CLAIM_TERMS = [/\bwill\b/i, /\bcoming soon\b/i, /\bgenerally available\b/i, /managed control-plane/i, /identity integration/i, /enterprise identity/i];

const OSS_ROUTE_PREFIXES = ['docs', 'gallery', 'download', 'security', 'whitepaper', 'roadmap'];
const ENTERPRISE_ROUTES = ['enterprise', 'contact'];

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile() && /\.(tsx?|mdx?)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function routeKey(file: string): string {
  const rel = path.relative(appRoot, file).replace(/\\/g, '/');
  return rel.split('/')[0] ?? '';
}

function lineNumber(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function scan(): Violation[] {
  const files = walk(appRoot);
  const violations: Violation[] = [];

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const firstSegment = routeKey(file);
    const isOss = OSS_ROUTE_PREFIXES.includes(firstSegment) || firstSegment === 'page.tsx';
    const isEnterprise = ENTERPRISE_ROUTES.includes(firstSegment) && file.endsWith('page.tsx');

    if (isOss) {
      for (const term of ENTERPRISE_ONLY_TERMS) {
        for (const match of text.matchAll(new RegExp(term.source, 'gi'))) {
          const start = match.index ?? 0;
          const lineText = text.split('\n')[lineNumber(text, start) - 1]?.trim() ?? '';
          if (/roadmap|beta|stub/i.test(lineText)) continue;
          violations.push({
            file: path.relative(repoRoot, file),
            line: lineNumber(text, start),
            rule: `OSS_ENTERPRISE_TERM(${term.source})`,
            text: lineText,
          });
        }
      }
    }

    if (isEnterprise) {
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('import ') || trimmed.includes('site.mode') || trimmed.startsWith('<option')) return;
        const hasClaim = ENTERPRISE_CLAIM_TERMS.some((term) => term.test(trimmed));
        if (!hasClaim) return;
        const hasLabel = ROADMAP_REQUIRED_TERMS.some((term) => term.test(line));
        if (hasLabel) return;
        violations.push({
          file: path.relative(repoRoot, file),
          line: idx + 1,
          rule: 'ENTERPRISE_CLAIM_REQUIRES_STUB_LABEL',
          text: line.trim(),
        });
      });
    }
  }

  return violations;
}

const violations = scan();
if (violations.length) {
  console.error(`validate-site-claims: found ${violations.length} violation(s).`);
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.text}`);
  }
  process.exit(1);
}

console.log('validate-site-claims: no violations found.');
