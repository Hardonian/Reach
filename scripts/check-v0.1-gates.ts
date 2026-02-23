import { execSync } from "child_process";

console.log("================================================================");
console.log("PHASE 3 — CI GUARDRAILS (ANTI-THEATRE + ANTI-BRITTLE HASHING)");
console.log("================================================================");

const runGitGrep = (pattern: string, args: string = "") => {
  try {
    // If grep finds something, it exits 0
    // We only want to search in src, internal, apps, crates etc. excluding tests, docs
    const cmd = `git grep -E -i '${pattern}' -- ':!*test*' ':!docs*' ':!scripts*' ':!*.test.*' ':!*.spec.*' ${args}`;
    const output = execSync(cmd, { stdio: "pipe" }).toString();
    return output;
  } catch (error: any) {
    if (error.status === 1) {
      // Grep exits 1 when it finds nothing. This is exactly what we want.
      return "";
    }
    // Any other error (like bad pattern, or error getting git context)
    throw error;
  }
};

let failed = false;

// A) No-Theatre Gate
console.log("Checking No-Theatre Gate...");
const theatrePattern =
  "SimulateConsensus|SimulateByzantine|Byzantine|consensus simulation|mock planner returning static orchestration blueprint";
const theatreOutput = runGitGrep(theatrePattern);
if (theatreOutput) {
  console.error("❌ ERROR: Found theatre logic in runtime path:");
  console.error(theatreOutput);
  failed = true;
} else {
  console.log("✅ No-Theatre Gate passed.");
}

// B) No Substring Hash Omission Gate
console.log("Checking No Substring Hash Omission Gate...");
const hashPattern =
  'strings\\.Contains\\(lowerK, "time"\\)|strings\\.Contains\\(lowerK, "uuid"\\)';
const hashOutput = runGitGrep(hashPattern);
if (hashOutput) {
  console.error(
    "❌ ERROR: Found substring-based hash omission in determinism code:",
  );
  console.error(hashOutput);
  failed = true;
} else {
  console.log("✅ No Substring Hash Omission Gate passed.");
}

// C) No go run CLI Gate
console.log("Checking No go run CLI Gate...");
const goRunPattern = "go run \\./cmd";
const goRunOutput = runGitGrep(goRunPattern);
if (goRunOutput) {
  console.error("❌ ERROR: Found 'go run ./cmd' in normal execution path:");
  console.error(goRunOutput);
  failed = true;
} else {
  console.log("✅ No go run CLI Gate passed.");
}

if (failed) {
  process.exit(1);
}
