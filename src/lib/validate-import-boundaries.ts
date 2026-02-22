import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const RUNNER_ROOT = path.join(ROOT, 'services', 'runner');

interface Rule {
  scope: string; // Regex for file path
  deny: string[]; // Regex for disallowed imports
  reason: string;
}

const RULES: Rule[] = [
  {
    scope: 'services/runner/internal/determinism',
    deny: ['services/runner/internal/api', 'services/runner/internal/jobs'],
    reason: 'Determinism engine must be pure and isolated from API/Jobs',
  },
  {
    scope: 'services/runner/internal/pack',
    deny: ['services/runner/internal/jobs'],
    reason: 'Pack logic should not depend on Job execution state',
  },
  {
    scope: 'services/runner/internal/.*',
    deny: ['services/cloud'],
    reason: 'Core runner cannot depend on cloud service modules',
  },
];

function walk(dir: string, callback: (file: string) => void) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else if (stats.isFile() && file.endsWith('.go')) {
      callback(filepath);
    }
  }
}

let errors = 0;

walk(RUNNER_ROOT, (file) => {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');

  for (const rule of RULES) {
    if (new RegExp(rule.scope).test(relPath)) {
      for (const deny of rule.deny) {
        const importRegex = new RegExp(`"${deny}.*"`, 'g');
        if (importRegex.test(content)) {
          console.error(`[BOUNDARY VIOLATION] ${relPath}`);
          console.error(`  Imported: ${deny}`);
          console.error(`  Reason:   ${rule.reason}`);
          errors++;
        }
      }
    }
  }
});

if (errors > 0) {
  console.error(`\nFound ${errors} boundary violations.`);
  process.exit(1);
}
console.log('✅ Import boundaries verified.');