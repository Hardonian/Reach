# Pull Request Guidelines

All PRs must meet these standards to maintain Reach's determinism and code quality guarantees.

---

## Pre-Submission Checklist

Run these commands before submitting:

```bash
# 1. System health check (must pass)
./reach doctor

# 2. Full verification suite (must pass)
pnpm run verify:full

# 3. Demo run validation (must complete)
./reach report demo
```

---

## PR Requirements

### 1. Tests Required

Every code change must include appropriate tests:

| Change Type | Test Requirement |
|-------------|------------------|
| **Bug fix** | Regression test that fails without the fix |
| **New feature** | Unit tests + integration test |
| **Performance** | Benchmark before/after with `reachctl benchmark` |
| **Refactor** | Existing tests must pass; add tests for new abstractions |
| **Documentation** | N/A (but verify with `./reach report demo`) |

**Test commands:**
```bash
# Rust engine
cd crates/engine && cargo test

# Go runner
cd services/runner && go test ./...

# Full suite
pnpm run verify:full
```

### 2. Zero Entropy Verification

Reach requires absolute determinism. Verify your changes:

```bash
# Run 5 times, all fingerprints must match
./reach verify-determinism --n 5 --pack <your-test-pack>
```

**Prohibited in core paths:**
- `time.Now()` without deterministic seed
- `math/rand` without seeded source
- Unordered map iteration
- Goroutine race conditions

**Allowed with care:**
- `time.Now()` for logging only (not logic)
- `crypto/rand` for cryptographic operations
- Ordered iteration via sort

### 3. Minimal Diff Principle

- Change only what is required
- One logical change per PR
- Split refactors into separate PRs
- Keep PRs under 500 lines when possible

---

## PR Description Template

```markdown
## Summary
One-sentence description of the change.

## Motivation
Why is this change needed? Link to issue if applicable.

## Changes
- [ ] Specific change 1
- [ ] Specific change 2

## Testing
<!-- Paste test output -->
```bash
$ cargo test
running 42 tests
test result: ok. 42 passed; 0 failed

$ ./reach verify-determinism --n 5
✓ All 5 fingerprints match
```

## Checklist
- [ ] Tests added/updated
- [ ] `./reach doctor` passes
- [ ] `./reach report demo` completes
- [ ] `pnpm run verify:full` passes
- [ ] Determinism verified (5 runs)
- [ ] Documentation updated (if needed)
```

---

## Review Standards

### Automated Checks (CI)

All PRs trigger:
- Lint (Go, Rust, TypeScript)
- Type checking
- Unit tests
- Integration tests
- Determinism verification

### Human Review

Required approvals:
- **1 maintainer** for docs/examples
- **2 maintainers** for core engine changes

Review focus:
1. Correctness - Does it solve the stated problem?
2. Determinism - Any entropy introduced?
3. Performance - Benchmarks acceptable?
4. Maintainability - Can others understand this?

---

## Common Rejection Reasons

| Issue | Resolution |
|-------|------------|
| CI failing | Fix before requesting review |
| No tests | Add regression/feature tests |
| Entropy detected | Replace non-deterministic sources |
| Too large | Split into smaller PRs |
| Undocumented | Add examples or docs |
| Breaking change | Discuss in issue first; provide migration |

---

## Merge Requirements

A PR is ready to merge when:

1. All CI checks pass ✓
2. Required reviews approved ✓
3. Author confirmed manual testing ✓
4. No `do-not-merge` label ✓
5. Branch is up-to-date with main ✓

**Merge strategy:**
- Use "Squash and merge" for clean history
- Ensure commit message follows Conventional Commits:
  - `feat(scope): description`
  - `fix(scope): description`
  - `docs(scope): description`
  - `test(scope): description`

---

## Related Resources

- [Contributing Guide](../../CONTRIBUTING.md) - Setup and conventions
- [CI Setup](../internal/CI_SETUP.md) - Pipeline internals
- [Determinism Spec](../internal/DETERMINISM_SPEC.md) - Entropy guidelines
- [Error Codes](../ERROR_CODE_REGISTRY.md) - RL-XXXX reference
