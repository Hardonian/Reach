/**
 * Test suite for canonical language enforcement.
 * Runs as a standalone Node.js script (no test framework needed).
 *
 * Usage: node scripts/__tests__/enforce-canonical-language.test.mjs
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// Test 1: Clean component produces no violations
console.log("\nTest 1: Clean component — no violations");
try {
  const out = execSync(
    `npx tsx scripts/enforce-canonical-language.ts`,
    { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  assert(out.includes("PASSED"), "Script reports PASSED for clean codebase");
} catch (e) {
  // If script exits non-zero, check if it's about our test fixtures
  // The fixtures are in __tests__ which is in SKIP_PATTERNS, so they should be skipped
  assert(false, "Script should pass — fixtures in __tests__ are skipped");
}

// Test 2: Verify fixtures directory is skipped (it's in __tests__)
console.log("\nTest 2: __tests__ directory is in SKIP_PATTERNS");
try {
  const out = execSync(
    `npx tsx scripts/enforce-canonical-language.ts`,
    { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  assert(
    !out.includes("violation-component"),
    "Violation fixture is not reported (skipped by __tests__ pattern)"
  );
} catch (e) {
  const stderr = e.stderr?.toString() || "";
  assert(
    !stderr.includes("violation-component"),
    "Violation fixture is not reported (skipped by __tests__ pattern)"
  );
}

// Test 3: Verify the script itself doesn't crash
console.log("\nTest 3: Script runs without crashing");
try {
  execSync(
    `npx tsx scripts/enforce-canonical-language.ts`,
    { cwd: repoRoot, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
  );
  assert(true, "Script exited cleanly (code 0)");
} catch (e) {
  assert(false, `Script crashed or found violations: ${e.message}`);
}

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
