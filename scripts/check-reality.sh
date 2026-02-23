#!/usr/bin/env bash
set -euo pipefail

echo "================================================================"
echo "PHASE 3 — CI GUARDRAILS (ANTI-THEATRE + ANTI-BRITTLE HASHING)"
echo "================================================================"

# A) No-Theatre Gate
# Fail build if runtime code contains banned terms
# Only scan runtime paths (exclude tests and docs)
echo "Checking No-Theatre Gate..."
if git grep -E -i "SimulateConsensus|SimulateByzantine|Byzantine|consensus simulation|mock planner returning static orchestration blueprint" \
    -- ':!*test*' ':!docs*' ':!scripts*' ':!*.test.*' ':!*.spec.*' > tmp_theatre_fails.txt 2>/dev/null; then
  echo "❌ ERROR: Found theatre logic in runtime path:"
  cat tmp_theatre_fails.txt
  rm tmp_theatre_fails.txt
  exit 1
fi
rm -f tmp_theatre_fails.txt
echo "✅ No-Theatre Gate passed."

# B) No Substring Hash Omission Gate
echo "Checking No Substring Hash Omission Gate..."
if git grep -E 'strings\.Contains\(lowerK, "time"\)|strings\.Contains\(lowerK, "uuid"\)' \
    -- ':!*test*' ':!docs*' ':!scripts*' ':!*.test.*' ':!*.spec.*' > tmp_hash_fails.txt 2>/dev/null; then
  echo "❌ ERROR: Found substring-based hash omission in determinism code:"
  cat tmp_hash_fails.txt
  rm tmp_hash_fails.txt
  exit 1
fi
rm -f tmp_hash_fails.txt
echo "✅ No Substring Hash Omission Gate passed."

# C) No go run CLI Gate
echo "Checking No go run CLI Gate..."
if git grep -E "go run \./cmd" \
    -- ':!*test*' ':!docs*' ':!*.test.*' ':!*.spec.*' > tmp_gorun_fails.txt 2>/dev/null; then
  echo "❌ ERROR: Found 'go run ./cmd' in normal execution path:"
  cat tmp_gorun_fails.txt
  rm tmp_gorun_fails.txt
  exit 1
fi
rm -f tmp_gorun_fails.txt
echo "✅ No go run CLI Gate passed."
