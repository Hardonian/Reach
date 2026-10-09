import fs from 'fs';
import path from 'path';

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

function listAllFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  if (!fs.statSync(dir).isDirectory()) return [dir];
  const out: string[] = [];
  collectFiles(dir, out);
  return out;
}

function findMatches(dir: string, re: RegExp): string[] {
  const results: string[] = [];
  for (const file of listAllFiles(dir)) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    content.split('\n').forEach((line, i) => {
      if (re.test(line)) results.push(`${file}:${i + 1}:${line.trim()}`);
    });
  }
  return results;
}

const FORBIDDEN_SDK_IMPORTS = [
  'stripe',
  'auth0',
  '@google-cloud',
  'aws-sdk',
  'azure-sdk',
];

const OSS_PATHS = ['core', 'services/runner', 'protocol'];

function validate() {
  console.log('Validating OSS Purity (Zero-Cloud Build Lock)...');

  if (process.env.REACH_CLOUD === '1') {
    console.log('Skipping: REACH_CLOUD is set.');
    return;
  }

  let hasError = false;

  for (const ossPath of OSS_PATHS) {
    const fullPath = path.join(process.cwd(), ossPath);
    if (!fs.existsSync(fullPath)) continue;

    for (const sdk of FORBIDDEN_SDK_IMPORTS) {
      const matches = findMatches(fullPath, new RegExp(`import.*${sdk}`));
      if (matches.length > 0) {
        console.error(
          `[PURITY ERROR] Cloud SDK '${sdk}' found in OSS path: ${ossPath}`,
        );
        console.error(matches.join('\n'));
        hasError = true;
      }
    }
  }

  if (hasError) {
    console.error(
      'FAIL: OSS purity check failed. Cloud dependencies detected in OSS-only paths.',
    );
    process.exit(1);
  }

  console.log('✓ OSS build purity verified (zero-cloud lock).');
}

validate();
