import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

type Rule = {
  path: string;
  forbidden: string[];
  reason: string;
};

const RULES: Rule[] = [
  {
    path: 'core',
    forbidden: ['cloud', 'services/billing', 'stripe', 'auth0'],
    reason: 'Core cannot import cloud or billing dependencies'
  },
  {
    path: 'services/runner/cmd/reachctl',
    forbidden: ['apps/arcade', 'next', 'react'],
    reason: 'CLI cannot import web/frontend dependencies'
  }
];

function validate() {
  console.log('Validating import boundaries...');
  let hasError = false;

  for (const rule of RULES) {
    const fullPath = path.join(ROOT, rule.path);
    if (!fs.existsSync(fullPath)) continue;

    console.log(`Checking ${rule.path}...`);
    
    // Use ripgrep to find forbidden imports
    for (const pattern of rule.forbidden) {
      try {
        const output = execSync(`rg "import.*${pattern}" ${fullPath} --vimgrep`, { encoding: 'utf8' });
        if (output) {
          console.error(`[VIOLATION] ${rule.reason}:`);
          console.error(output);
          hasError = true;
        }
      } catch (e) {
        // rg returns non-zero if no matches found, which is what we want
      }
    }
  }

  if (hasError) {
    process.exit(1);
  }
  console.log('✓ Import boundaries verified.');
}

validate();
