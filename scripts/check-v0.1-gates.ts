import { execSync } from "child_process";
import * as fs from "fs";

console.log("================================================================");
console.log("PHASE 3 — CI GUARDRAILS (ANTI-THEATRE + ANTI-BRITTLE HASHING)");
console.log("================================================================");

const getFiles = () => {
  try {
    const filesMatch = execSync("git ls-files", { stdio: "pipe" })
      .toString()
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    // exclude tests, docs, scripts, readmes, binaries, data
    return filesMatch.filter(
      (f) =>
        !f.includes("test") &&
        !f.includes("docs/") &&
        !f.includes("scripts/") &&
        !f.includes(".test.") &&
        !f.includes(".spec.") &&
        !f.toLowerCase().endsWith(".md") &&
        !f.toLowerCase().endsWith(".exe") &&
        !f.toLowerCase().endsWith(".json") &&
        !f.toLowerCase().endsWith(".lock") &&
        !f.toLowerCase().endsWith(".txt") &&
        !f.toLowerCase().endsWith(".tsbuildinfo") &&
        !f.includes("node_modules/") &&
        !f.includes("dist/") &&
        !f.includes("build/") &&
        !f.includes("ARTIFACTS/"),
    );
  } catch {
    return [];
  }
};

const runManualGrep = (pattern: RegExp, fileFilter?: (f: string) => boolean) => {
  const allFiles = getFiles();
  const files = fileFilter ? allFiles.filter(fileFilter) : allFiles;
  const matched = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const content = fs.readFileSync(f, "utf8");
    const lines = content.split("\n");
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
const theatrePattern =
  /SimulateConsensus|SimulateByzantine|Byzantine|consensus simulation|mock planner returning static orchestration blueprint/i;
const theatreOutput = runManualGrep(theatrePattern);
if (theatreOutput.length > 0) {
  console.error("❌ ERROR: Found theatre logic in runtime path:");
  theatreOutput.forEach((line) => console.error(line));
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
  hashOutput.forEach((line) => console.error(line));
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
  goRunOutput.forEach((line) => console.error(line));
  failed = true;
} else {
  console.log("✅ No go run CLI Gate passed.");
}

// D) No localeCompare Gate (Determinism)
console.log("Checking No localeCompare Gate...");
const localeComparePattern = /\.localeCompare\(/;
const localeCompareOutput = runManualGrep(localeComparePattern);
if (localeCompareOutput.length > 0) {
  console.error(
    "❌ ERROR: Found '.localeCompare(' in runtime path. Use codePointCompare instead for determinism.",
  );
  localeCompareOutput.forEach((line) => console.error(line));
  failed = true;
} else {
  console.log("✅ No localeCompare Gate passed.");
}

// E) No time.Now in Determinism Boundary
console.log("Checking No time.Now in Determinism Boundary...");
const timeNowPattern = /time\.Now\(/;
const determinismFilter = (f: string) =>
  f.includes("internal/determinism/") || f.includes("crates/engine/");
const timeNowOutput = runManualGrep(timeNowPattern, determinismFilter);
if (timeNowOutput.length > 0) {
  console.error("❌ ERROR: Found 'time.Now(' in determinism boundary:");
  timeNowOutput.forEach((line) => console.error(line));
  failed = true;
} else {
  console.log("✅ No time.Now in Determinism Boundary passed.");
}

// F) No rand in Determinism Boundary
console.log("Checking No rand in Determinism Boundary...");
const randPattern = /math\/rand|crypto\/rand|rand\.Seed|rand\.Int/;
const randOutput = runManualGrep(randPattern, determinismFilter);
if (randOutput.length > 0) {
  console.error("❌ ERROR: Found non-deterministic rand usage in determinism boundary:");
  randOutput.forEach((line) => console.error(line));
  failed = true;
} else {
  console.log("✅ No rand in Determinism Boundary passed.");
}

// G) No direct DB access outside storage layer
console.log("Checking No direct DB access outside storage layer...");
const dbAccessPattern = /sql\.Open|sql\.DB|gorm\.Open|ent\.Open|sqlite3|qlite\./;
const dbFilter = (f: string) =>
  !f.includes("internal/storage/") &&
  !f.includes("internal/db/") &&
  !f.includes("tools/doctor/") &&
  !f.includes("scripts/");
const dbOutput = runManualGrep(dbAccessPattern, dbFilter);
if (dbOutput.length > 0) {
  console.error("❌ ERROR: Found direct DB/SQL access outside storage layer:");
  dbOutput.forEach((line) => console.error(line));
  failed = true;
} else {
  console.log("✅ No direct DB access outside storage layer passed.");
}

if (failed) {
  process.exit(1);
}
