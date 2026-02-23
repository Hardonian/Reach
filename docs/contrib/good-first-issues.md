# Good First Issues

Welcome! These issues are curated for new contributors. Each has clear acceptance criteria and is scoped for a first-time PR.

---

## How to Use This List

1. **Pick an issue** matching your skills/interest
2. **Comment on the issue** to claim it (prevents duplicate work)
3. **Follow the starter PR guide** at [starter-prs.md](./starter-prs.md)
4. **Ask questions** in the issue or Discord - we're here to help

---

## Documentation

### 1. Fix Broken Links in INSTALL.md

**Files:** `docs/INSTALL.md`  
**Difficulty:** ⭐ Beginner  
**Time:** 15 minutes

**Description:** Several external links in the installation guide are outdated or 404.

**Acceptance Criteria:**

- [ ] All links return HTTP 200 (use `lychee` or similar)
- [ ] Update Docker Hub links to current repository
- [ ] Fix any redirected URLs

**Test Expectations:**

```bash
# Run link checker
lychee docs/INSTALL.md
# Should report 0 errors
```

---

### 2. Add Code of Conduct Reference to README

**Files:** `README.md`  
**Difficulty:** ⭐ Beginner  
**Time:** 10 minutes

**Description:** The README links to CONTRIBUTING.md but not CODE_OF_CONDUCT.md.

**Acceptance Criteria:**

- [ ] Add "Code of Conduct" link in Contributing section
- [ ] Place it adjacent to Contributing link

**Test Expectations:**

- [ ] Link resolves correctly
- [ ] Markdown renders properly

---

### 3. Document Environment Variables

**Files:** `docs/ENVIRONMENT_VARIABLES.md` (new file)  
**Difficulty:** ⭐⭐ Beginner-Intermediate  
**Time:** 1 hour

**Description:** Create a comprehensive reference for all environment variables.

**Acceptance Criteria:**

- [ ] Document `REACH_DATA_DIR` (default, purpose, example)
- [ ] Document `REACH_BASE_URL` (default, purpose, example)
- [ ] Document `REACH_LOG_LEVEL` (valid values: debug, info, warn, error)
- [ ] Document `REACH_RETENTION_DAYS`
- [ ] Document `REACH_COMPACTION_ENABLED`
- [ ] Add table format with Variable | Description | Default | Required

**Test Expectations:**

- [ ] File renders correctly in GitHub preview
- [ ] All variables from `docs/INSTALL.md` are covered

---

### 4. Add Doc Comments to Example Scripts

**Files:** `examples/*/run.js`  
**Difficulty:** ⭐ Beginner  
**Time:** 30 minutes

**Description:** Add JSDoc comments to example runner scripts for better IDE support.

**Acceptance Criteria:**

- [ ] Add `@param` and `@returns` to functions
- [ ] Add file-level description comments
- [ ] Document the `main()` function purpose

**Test Expectations:**

- [ ] No functional changes to code
- [ ] Examples still run: `node examples/01-quickstart-local/run.js`

---

## Testing

### 5. Add Unit Tests for Doctor Checks

**Files:** `tools/doctor/doctor_test.go`  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 2 hours

**Description:** The doctor tool lacks tests for individual checks.

**Acceptance Criteria:**

- [ ] Add test for `checkNodeVersion` with version 16, 18, 20
- [ ] Add test for `checkEnvConfiguration` with/without .env
- [ ] Mock `exec.LookPath` for testability

**Test Expectations:**

```bash
cd tools/doctor && go test -v
# All new tests pass
# Coverage increases by at least 20%
```

---

### 6. Create Test Fixture Validator

**Files:** `scripts/validate-fixtures.js` (new file)  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1.5 hours

**Description:** Script to validate all fixtures in `fixtures/` directory.

**Acceptance Criteria:**

- [ ] Validate JSON syntax for all `.json` files
- [ ] Check required `_fixture` metadata exists
- [ ] Verify `schema_version` matches expected format
- [ ] Return exit code 0 on success, 1 on failure

**Test Expectations:**

```bash
node scripts/validate-fixtures.js
# Should pass for all current fixtures
# Should fail if fixture is invalid
```

---

### 7. Add Determinism Test for Simple Decision

**Files:** `fixtures/decision/input/simple.json`, `tests/determinism/`  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1 hour

**Description:** Verify the simple decision fixture produces consistent fingerprints.

**Acceptance Criteria:**

- [ ] Create test that runs decision 3 times
- [ ] Verify all fingerprints match
- [ ] Add to CI test suite

**Test Expectations:**

```bash
./reach verify-determinism --n 3 \
  --input fixtures/decision/input/simple.json
# All 3 fingerprints identical
```

---

## Tooling/Scripts

### 8. Create Shell Completion Generator

**Files:** `scripts/generate-completions.sh` (new file)  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Time:** 2 hours

**Description:** Generate shell completions for bash, zsh, fish.

**Acceptance Criteria:**

- [ ] Generate bash completions
- [ ] Generate zsh completions
- [ ] Generate fish completions
- [ ] Output to `completions/` directory

**Test Expectations:**

```bash
./scripts/generate-completions.sh
source completions/reach.bash
reach <TAB>  # Should show completions
```

---

### 9. Add Makefile Targets for Common Tasks

**Files:** `Makefile`  
**Difficulty:** ⭐ Beginner  
**Time:** 30 minutes

**Description:** Add convenient make targets for development.

**Acceptance Criteria:**

- [ ] Add `make doctor` → `./reach doctor`
- [ ] Add `make demo` → `node examples/01-quickstart-local/run.js`
- [ ] Add `make fixtures` → validate all fixtures
- [ ] Add `make clean` → remove node_modules, dist, etc.

**Test Expectations:**

```bash
make doctor  # Runs reach doctor
make demo    # Runs demo
make clean   # Cleans build artifacts
```

---

### 10. Create Git Hook for Pre-commit Checks

**Files:** `.githooks/pre-commit` (new file), `scripts/install-hooks.sh`  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1 hour

**Description:** Optional git hook to run basic checks before commit.

**Acceptance Criteria:**

- [ ] Check JSON files are valid
- [ ] Run `reach doctor` (warn only)
- [ ] Check for trailing whitespace
- [ ] Create install script

**Test Expectations:**

```bash
./scripts/install-hooks.sh
# Make a test commit
# Hook runs without errors
```

---

## Examples

### 11. Add Python Example Runner

**Files:** `examples/01-quickstart-local/run.py` (new file)  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1 hour

**Description:** Python equivalent of the JavaScript example runner.

**Acceptance Criteria:**

- [ ] Equivalent functionality to run.js
- [ ] Use subprocess to call reach
- [ ] Handle errors gracefully
- [ ] Add README section for Python users

**Test Expectations:**

```bash
python examples/01-quickstart-local/run.py
# Same output as node run.js
```

---

### 12. Create Example: Conditional Logic

**Files:** `examples/11-conditional-logic/` (new directory)  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 2 hours

**Description:** Example demonstrating conditional decision branches.

**Acceptance Criteria:**

- [ ] Create pack.json with conditional logic
- [ ] Create seed.json with test inputs
- [ ] Create run.js runner
- [ ] Add README.md explaining the logic

**Test Expectations:**

```bash
node examples/11-conditional-logic/run.js
# Completes without errors
# Output shows conditional branching
```

---

### 13. Add Example Output Comparison Script

**Files:** `examples/compare-outputs.js` (new file)  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1 hour

**Description:** Script to compare outputs of different examples.

**Acceptance Criteria:**

- [ ] Run multiple examples
- [ ] Compare fingerprints
- [ ] Show which examples produce different outputs
- [ ] Export comparison to JSON

**Test Expectations:**

```bash
node examples/compare-outputs.js
# Produces comparison report
```

---

## Fixtures

### 14. Add Multi-Scenario Event Fixture

**Files:** `fixtures/events/multi-scenario.json` (new file)  
**Difficulty:** ⭐ Beginner  
**Time:** 30 minutes

**Description:** Create a fixture with 5+ scenarios for stress testing.

**Acceptance Criteria:**

- [ ] 5+ scenarios with varying probabilities
- [ ] 3+ actions
- [ ] Include adversarial flag on some scenarios
- [ ] Follow `_fixture` metadata format

**Test Expectations:**

```bash
node -e "JSON.parse(require('fs').readFileSync('fixtures/events/multi-scenario.json'))"
# Parses without errors
```

---

### 15. Create Fixture Usage Examples

**Files:** `fixtures/USAGE_EXAMPLES.md` (new file)  
**Difficulty:** ⭐ Beginner  
**Time:** 45 minutes

**Description:** Document practical usage of fixtures for testing.

**Acceptance Criteria:**

- [ ] Show how to use with `reach run`
- [ ] Show how to compare outputs
- [ ] Show how to use in CI
- [ ] Include 3 complete examples

**Test Expectations:**

- [ ] All commands in examples work when copied

---

## Error Handling

### 16. Improve Error Messages for Invalid JSON

**Files:** `services/runner/internal/errors/`  
**Difficulty:** ⭐⭐⭐ Intermediate-Advanced  
**Time:** 2 hours

**Description:** When JSON parsing fails, show line number and context.

**Acceptance Criteria:**

- [ ] Parse error includes line number
- [ ] Parse error includes column hint
- [ ] Show snippet of invalid JSON (sanitized)

**Test Expectations:**

```bash
echo '{invalid}' | ./reach run -
# Shows helpful error with line info
```

---

### 17. Add Context to CONFIG_MISSING Error

**Files:** `services/runner/internal/config/`  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1 hour

**Description:** CONFIG_MISSING error should say WHICH config is missing.

**Acceptance Criteria:**

- [ ] Error message includes missing variable name
- [ ] Suggest command to fix (`reach doctor --fix`)
- [ ] List all required configs if multiple missing

**Test Expectations:**

```bash
unset REACH_DATA_DIR && ./reach run ...
# Error: "CONFIG_MISSING: REACH_DATA_DIR not set. Run: reach doctor --fix"
```

---

## Performance

### 18. Add Benchmark for Decision Evaluation

**Files:** `crates/engine/benches/decision_benchmark.rs`  
**Difficulty:** ⭐⭐⭐ Intermediate  
**Time:** 2 hours

**Description:** Criterion benchmark for core decision evaluation.

**Acceptance Criteria:**

- [ ] Benchmark simple decision (2 actions, 2 scenarios)
- [ ] Benchmark complex decision (10 actions, 5 scenarios)
- [ ] Output to `target/criterion/`

**Test Expectations:**

```bash
cd crates/engine && cargo bench
# Benchmarks run successfully
# Baseline established
```

---

### 19. Create Performance Regression Script

**Files:** `scripts/perf-check.sh` (new file)  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1.5 hours

**Description:** Script to check performance hasn't regressed.

**Acceptance Criteria:**

- [ ] Run benchmarks
- [ ] Compare to baseline
- [ ] Fail if >10% slower
- [ ] Generate report

**Test Expectations:**

```bash
./scripts/perf-check.sh
# Passes if performance within threshold
```

---

## Accessibility/UX

### 20. Add Color Output Control

**Files:** `services/runner/internal/output/`  
**Difficulty:** ⭐⭐ Intermediate  
**Time:** 1.5 hours

**Description:** Support `NO_COLOR` environment variable.

**Acceptance Criteria:**

- [ ] Check `NO_COLOR` env var
- [ ] Disable ANSI colors when set
- [ ] Respect `FORCE_COLOR` for override
- [ ] Document in troubleshooting

**Test Expectations:**

```bash
NO_COLOR=1 ./reach doctor
# Output has no ANSI escape codes
grep -c '\[3[0-9]m' <<< "$output"  # Should be 0
```

---

## Claiming an Issue

To claim an issue:

1. Open a new issue referencing this number (e.g., "Good First Issue #5: Add Unit Tests")
2. Or comment on an existing tracking issue
3. Include your planned approach and timeline

---

## Need Help?

- **Discord:** [Join our community](https://discord.gg/reach)
- **Discussions:** [GitHub Discussions](../../discussions)
- **Docs:** [Contributing Guide](../../CONTRIBUTING.md)
- **Mentorship:** Mention @reach-mentors in your issue

Happy contributing! 🚀
