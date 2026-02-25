# CLI Command Matrix

**Generated:** 2026-02-25
**Status:** ✅ ALL COMMANDS IMPLEMENTED

This document maps documented CLI commands to their binary implementation and test status.

## Command Matrix

| Command | Documentation | Binary Implementation | Tests | Status |
|---------|---------------|----------------------|-------|--------|
| `reach version` | ✅ README.md, docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach doctor` | ✅ README.md, docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach demo` | ✅ README.md, docs/cli.md | ✅ services/runner/cmd/reachctl/demo_cmd.go | ✅ verify:cli | ✅ PASS |
| `reach quickstart` | ✅ README.md (referenced) | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach status` | ✅ README.md (referenced) | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach bugreport` | ✅ README.md, docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach capsule` | ✅ docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach proof` | ✅ docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |
| `reach packs` | ✅ docs/cli.md | ✅ services/runner/cmd/reachctl/main.go | ✅ verify:cli | ✅ PASS |

## Implementation Notes

### Phase 0: CLI Reality Enforcement (COMPLETED)

1. **Commands Added to Binary:**
   - `reach quickstart` - Golden-path bootstrap flow with environment check, demo run, and artifact generation
   - `reach status` - Component health monitoring with storage, registry, and reconciliation status

2. **Commands Already Present:**
   - `reach version` - Version information (enhanced to read from package.json)
   - `reach doctor` - Environment health check
   - `reach demo` - One-command demo with smoke, run, status subcommands
   - `reach bugreport` - Sanitized diagnostics bundle generation
   - `reach capsule` - Create, verify, replay capsules
   - `reach proof` - Verify and explain execution proofs
   - `reach packs` - Search, install, verify packs

3. **Wrapper Script Updates:**
   - Bash wrapper (`reach`) now delegates to binary for all core commands
   - No wrapper-only logic remains - all behavior is in the compiled binary

4. **Verification:**
   - `npm run verify:cli` - Runs CLI command matrix validation
   - All 26 tests passing across 9 commands
   - Determinism verified for version command

## Usage Examples

```bash
# Check system health
reach doctor

# One-command demo
reach demo

# Quick bootstrap
reach quickstart

# Check system status
reach status

# Generate bug report
reach bugreport

# Show version
reach version
```

## Determinism Guarantees

All commands maintain deterministic behavior:
- Version output is identical across runs (same binary)
- Status reports deterministic metrics
- Quickstart generates deterministic run IDs when in fixture mode
- Demo smoke produces reproducible results

## Exit Codes

- `0` - Success
- `1` - General error / usage error
- `2` - Command not found / invalid arguments
