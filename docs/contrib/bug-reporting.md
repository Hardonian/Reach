# Bug Reporting Guide

This guide ensures bugs are reported with sufficient context for rapid reproduction and resolution.

---

## Before You Report

1. **Search existing issues** - Check [GitHub Issues](../../issues) for duplicates
2. **Verify on latest version** - Run `./reach doctor` to confirm your version
3. **Isolate the problem** - Test with a minimal pack configuration

---

## Required Diagnostics

Every bug report must include output from these two commands:

### 1. System Health Check

```bash
./reach doctor
```

**Expected output:**

```
Reach Doctor
─────────────────────────────
✓  Go:     1.22.7
✓  SQLite: 3.45.0
✓  Data:   ~/.reach/ (accessible)
✓  Policy: strict-default v1 (valid)
```

### 2. Demo Report Generation

```bash
./reach report demo
```

This generates a shareable artifact at `demo-report/` containing:

- Environment snapshot (versions, platform)
- Available examples timeline
- Example execution output (sanitized)
- Integrity hash for verification

**Attach the generated `demo-report/manifest.json` to your bug report.**

---

## Bug Report Template

Use this structure when filing an issue:

```markdown
## Summary

One-sentence description of the bug.

## Environment

<!-- Paste ./reach doctor output here -->

## Steps to Reproduce

1. Run `reach ...`
2. Observe ...
3. Error occurs

## Expected Behavior

What should have happened.

## Actual Behavior

What actually happened.

## Diagnostics

<!-- Attach demo-report/manifest.json -->

- Report ID: demo-xxx-yyy
- Integrity Hash: abc123...

## Additional Context

- Does it reproduce consistently?
- Any workarounds discovered?
```

---

## Severity Rubric

| Severity     | Definition                                          | Example                                          | Response Target |
| ------------ | --------------------------------------------------- | ------------------------------------------------ | --------------- |
| **Critical** | Data loss, security breach, or complete unusability | Corrupted replay artifacts, policy bypass        | 24 hours        |
| **High**     | Core functionality broken with no workaround        | Replay divergence in production, export failures | 72 hours        |
| **Medium**   | Feature impaired but workaround exists              | Non-deterministic ordering in specific packs     | 1 week          |
| **Low**      | Cosmetic, documentation, or edge case               | Typos in CLI output, help text errors            | Next release    |

---

## Information NOT to Include

- **Secrets** - Never paste API keys, tokens, or credentials
- **Proprietary data** - Sanitize pack inputs containing business logic
- **Personal information** - Remove names, emails from logs

The `./reach report demo` command automatically sanitizes outputs to avoid these issues.

---

## Command-Specific Debugging

### Replay Failures

```bash
# Get detailed divergence information
./reach replay <run-id> --verbose

# Compare two runs
./reach diff-run <run-id-a> <run-id-b>
```

### Policy Denials

```bash
# Understand why a run was blocked
./reach explain-failure <run-id>
```

### Export/Import Issues

```bash
# Verify bundle integrity
./reach verify-proof <path-to-bundle.reach.zip>
```

---

## Related Resources

- [Error Code Registry](../ERROR_CODE_REGISTRY.md) - Lookup RL-XXXX codes
- [Troubleshooting Guide](../troubleshooting.md) - Common issues and fixes
- [Internal: Doctor Spec](../internal/DOCTOR.md) - System check internals
