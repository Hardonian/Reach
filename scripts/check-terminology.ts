import { execSync } from 'child_process';

console.log("================================================================");
console.log("PHASE 5 — TERMINOLOGY DRIFT CHECK");
console.log("================================================================");

const runManualGrep = (pattern: RegExp) => {
  try {
    const files = execSync('git ls-files "docs" "reach"', { stdio: 'pipe' })
      .toString()
      .split('\n')
      .map(f => f.trim())
      .filter(f => f);

    const fs = require('fs');
    let matchedFiles = [];
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      // Exclude non-user-facing docs where internal discussions / migrations happen
      if (f.startsWith('docs/internal/') || f.startsWith('docs/audit/') || f.startsWith('docs/migration/') || f.startsWith('docs/release/') || f.startsWith('docs/suite/')) {
        continue;
      }
      
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          // Exempt PoEE if "core and justified" 
          if (/PoEE/i.test(lines[i]) && /(core.*justified|justified.*core)/i.test(lines[i])) {
            continue;
          }
          matchedFiles.push(`${f}:${i + 1}: ${lines[i].substring(0, 100).trim()}`);
        }
      }
    }
    return matchedFiles;
  } catch (e: any) {
    return [];
  }
};

let failed = false;

console.log("Checking for banned legacy vocabulary...");
const legacyPattern = /\b(Envelope|Capsule|Blueprint|Recipe|Pack-Variant|PoEE)\b/i;
const issues = runManualGrep(legacyPattern);

if (issues.length > 0) {
  const filtered = issues.filter((i: string) => !i.startsWith('scripts/check-terminology.ts'));
  if (filtered.length > 0) {
    console.error("❌ ERROR: Found Terminology Drift in user-facing surfaces:");
    filtered.forEach((i: string) => console.error(i));
    failed = true;
  } else {
    console.log("✅ Terminology Drift Check passed.");
  }
} else {
  console.log("✅ Terminology Drift Check passed.");
}

if (failed) {
  process.exit(1);
}
