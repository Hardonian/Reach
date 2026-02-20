# Documentation Drift Guard

The Documentation Drift Guard is an automated system designed to prevent entropy between the Reach codebase, its documentation, and repository truth sources.

## Overview

The system consists of several auditors that cross-check different aspects of the repository:

1.  **Link Auditor** (`links.ts`): Detects dead internal links, casing mismatches, and orphaned routes in `apps/arcade`.
2.  **Truth Validator** (`truth.ts`): Cross-checks `README.md`, `AGENTS.md`, and other core docs against actual file paths, package scripts, and environment variables.
3.  **Claim Scanner** (`claims.ts`): Detects high-risk marketing claims (e.g., "SOC2", "zero data stored") and ensures they are either verified or allowlisted.
4.  **Smoke Tests** (`smoke.ts`): Probes documentation routes to ensure they are accessible.

## Commands

### Run All Auditors
```bash
npm run docs:doctor
```

### Run with Autofix (Safe)
```bash
npm run docs:doctor:fix
```
*Supports safe fixes like link casing and command reference updates.*

### Run Smoke Tests
```bash
# Requires a running server at http://localhost:3000
npx tsx tools/docs/drift/smoke.ts
```

## Configuration

### Claim Allowlist
Verified high-risk claims can be added to:
`tools/docs/drift/claims.allowlist.json`

## CI Integration
The system is integrated into GitHub Actions via `.github/workflows/docs-drift.yml`. It runs on every pull request to `main` and fails if drift is detected.

## Reports
Audit reports are generated in JSON format at:
`.artifacts/docs-drift/*.report.json`
