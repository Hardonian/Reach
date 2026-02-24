#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|mdx)$/.test(entry.name)) files.push(full);
  }
};
walk(root);

const banned = [/guaranteed\s+100%\s+secure/i, /unbreakable/i, /impossible\s+to\s+attack/i];
let violations = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of banned) {
    if (rule.test(text)) {
      console.error(`claim-lint violation: ${file} matched ${rule}`);
      violations += 1;
    }
  }
}
if (violations > 0) process.exit(1);
console.log(`claims-lint passed (${files.length} files checked)`);
