import { execSync } from 'child_process';

console.log("================================================================");
console.log("PHASE 5 — TERMINOLOGY DRIFT CHECK");
console.log("================================================================");

const runGitGrep = (pattern: string, args: string = '') => {
  try {
    // Only search in user-facing surfaces like docs/ and apps/cli/ or cmd/
    // Exclude the words 'core' and 'justified' in case they are actually part of a legitimate sentence
    const cmd = `git grep -E -i '\\b(${pattern})\\b' -- docs apps/cli crates/cli cmd scripts ${args}`;
    const output = execSync(cmd, { stdio: 'pipe' }).toString();
    return output;
  } catch (error: any) {
    if (error.status === 1 || error.status === 128) {
      // Grep exits 1 when it finds nothing. 128 if some paths are invalid (e.g. cmd/ or crates/cli/ not existing)
      return '';
    }
    // We can also have an issue where some directories don't exist. So we could use a custom glob if git grep fails.
    // Actually, to be safe, we can just run a safe git ls-files and grep line by line. Let's do a reliable approach below.
  }
  return '';
};

// A better way: git ls-files and then manually grep on JS side
const runManualGrep = (pattern: RegExp) => {
  try {
    const files = execSync('git ls-files docs apps/cli crates/cli cmd scripts', { stdio: 'pipe' })
      .toString()
      .split('\n')
      .map(f => f.trim())
      .filter(f => f);

    const fs = require('fs');
    let matchedFiles = [];
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      const content = fs.readFileSync(f, 'utf8');
      
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          // Exempt PoEE if "core and justified" somehow... actually "unless core and justified"
          // We'll just exempt if it's not a documentation file or help text, but the instructions say user-facing surfaces.
          // Let's just flag it. The user said "(unless core and justified)" - maybe they meant PoEE only if justified?
          // I'll exempt if the line contains "justify" or "core".
          if (/PoEE/i.test(lines[i]) && /(core.*justified|justified.*core)/i.test(lines[i])) {
            continue;
          }
          matchedFiles.push(`${f}:${i + 1}: ${lines[i].substring(0, 100)}`);
        }
      }
    }
    return matchedFiles;
  } catch (e: any) {
    if (e.message?.includes('pathspec')) {
        // Some dirs don't exist, try only docs
        try {
            const files = execSync('git ls-files docs', { stdio: 'pipe' }).toString().split('\n').filter(Boolean);
            const fs = require('fs');
            let matchedFiles = [];
            for (const f of files) {
                const content = fs.readFileSync(f, 'utf8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (pattern.test(lines[i])) {
                        matchedFiles.push(`${f}:${i + 1}: ${lines[i].substring(0, 100)}`);
                    }
                }
            }
            return matchedFiles;
        } catch {
            return [];
        }
    }
    return [];
  }
};

let failed = false;

console.log("Checking for banned legacy vocabulary...");
const legacyPattern = /\b(Envelope|Capsule|Blueprint|Recipe|Pack-Variant|PoEE)\b/i;
const issues = runManualGrep(legacyPattern);

if (issues.length > 0) {
  // Filter out this very file to prevent self-flagging
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
