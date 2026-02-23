import { execSync } from 'child_process';
import * as fs from 'fs';

console.log("================================================================");
console.log("PHASE 3 — CI GUARDRAILS (ANTI-THEATRE + ANTI-BRITTLE HASHING)");
console.log("================================================================");

const getFiles = () => {
    try {
        const filesMatch = execSync('git ls-files', { stdio: 'pipe' }).toString().split('\n').filter(Boolean);
        // exclude tests, docs, scripts
        return filesMatch.filter(f => !f.includes('test') && !f.includes('docs/') && !f.includes('scripts/') && !f.includes('.test.') && !f.includes('.spec.'));
    } catch {
        return [];
    }
};

const runManualGrep = (pattern: RegExp) => {
    const files = getFiles();
    let matched = [];
    for (const f of files) {
        if (!fs.existsSync(f)) continue;
        const content = fs.readFileSync(f, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                matched.push(`${f}:${i + 1}: ${lines[i].substring(0, 100).trim()}`);
            }
        }
    }
    return matched;
};

let failed = false;

// A) No-Theatre Gate
console.log("Checking No-Theatre Gate...");
const theatrePattern = /SimulateConsensus|SimulateByzantine|Byzantine|consensus simulation|mock planner returning static orchestration blueprint/i;
const theatreOutput = runManualGrep(theatrePattern);
if (theatreOutput.length > 0) {
  console.error("❌ ERROR: Found theatre logic in runtime path:");
  theatreOutput.forEach(line => console.error(line));
  failed = true;
} else {
  console.log("✅ No-Theatre Gate passed.");
}

// B) No Substring Hash Omission Gate
console.log("Checking No Substring Hash Omission Gate...");
const hashPattern = /strings\.Contains\(lowerK, "time"\)|strings\.Contains\(lowerK, "uuid"\)/;
const hashOutput = runManualGrep(hashPattern);
if (hashOutput.length > 0) {
  console.error("❌ ERROR: Found substring-based hash omission in determinism code:");
  hashOutput.forEach(line => console.error(line));
  failed = true;
} else {
  console.log("✅ No Substring Hash Omission Gate passed.");
}

// C) No go run CLI Gate
console.log("Checking No go run CLI Gate...");
const goRunPattern = /go run \.\/cmd/;
const goRunOutput = runManualGrep(goRunPattern);
if (goRunOutput.length > 0) {
  console.error("❌ ERROR: Found 'go run ./cmd' in normal execution path:");
  goRunOutput.forEach(line => console.error(line));
  failed = true;
} else {
  console.log("✅ No go run CLI Gate passed.");
}

if (failed) {
  process.exit(1);
}
