# Merge Playbook — OSS Suite v2

Last Updated: 2026-02-22

## Purpose

This document defines the safe merge strategy for parallel track development of the OSS Suite v2 expansion. All agents must follow this playbook to ensure conflict-free merges and maintain baseline integrity.

---

## Parallel Track Overview

| Track | Focus Area | Primary Files | Isolation Level |
| :--- | :--- | :--- | :--- |
| **J** | Recipe System + Starter Packs | `services/runner/internal/recipe/`, `packs/`, `examples/recipes/` | High |
| **K** | GitHub-native UX | `.github/workflows/`, `services/runner/internal/github/` | High |
| **L** | Reporting Suite + Bundles | `services/runner/internal/reporting/`, `docs/suite/REPORTING.md` | High |
| **M** | Tutorial Mode | `services/runner/internal/tutorial/`, `docs/suite/TUTORIAL.md` | High |
| **N** | Plugin Packaging | `services/runner/internal/plugins/`, `plugins/` | High |
| **O** | Fix-it Loop | `services/runner/internal/fixit/`, `docs/suite/FIX_IT_LOOP.md` | High |
| **P** | Run Explorer | `services/runner/internal/explorer/`, `docs/suite/RUN_EXPLORER.md` | High |
| **Q** | Release Engineering | `scripts/release/`, `docs/suite/RELEASING.md` | Medium |

---

## Pre-Merge Checklist (MANDATORY)

Before merging ANY track, verify:

```bash
# 1. OSS Gate must pass
npm run verify:oss

# 2. All validation checks must pass
npm run validate:language
npm run validate:boundaries
npm run validate:oss-purity

# 3. Go vet and build must succeed
cd services/runner && go vet ./... && go build ./...

# 4. Tests must pass
cd services/runner && go test ./...
```

---

## Merge Sequence

### Phase 0: Infrastructure (Complete First)
1. Create directory structure: `docs/suite/`, `examples/recipes/`, `plugins/`
2. Add this MERGE_PLAYBOOK.md
3. Verify baseline passes

### Phase 1: Core Features (Parallel Safe)
Tracks J, L, M, N, O, P can run in parallel as they touch isolated directories.

### Phase 2: Integration Features
Track K (GitHub) and Track Q (Release) should follow core features.

---

## Conflict Resolution Rules

### Overlapping Files
If two tracks must modify the same file:

1. **`services/runner/cmd/reachctl/main.go`**
   - Each track adds its own command handler
   - Use clear section comments: `// === TRACK J: Recipe Commands ===`
   - Register commands in the main switch statement alphabetically

2. **`package.json`**
   - Only Track Q should modify scripts
   - Other tracks: document required scripts in track notes

3. **`docs/EVIDENCE_CHAIN_MODEL.md`**
   - Append-only updates
   - Each track adds its section at the end

4. **`protocol/schemas/events.schema.json`**
   - Append-only for new event types
   - Coordinate event type IDs to avoid collisions

---

## Track Isolation Guarantees

### Track J: Recipe System
- **New Directory**: `services/runner/internal/recipe/`
- **New Directory**: `packs/`
- **New Directory**: `examples/recipes/`
- **CLI Commands**: `recipe list`, `recipe run`, `recipe explain`, `recipe pack add/list`

### Track K: GitHub Integration
- **New Directory**: `services/runner/internal/github/`
- **New File**: `.github/workflows/reach.yml`
- **CLI Commands**: `github check`, `github comment`

### Track L: Reporting Suite
- **New Directory**: `services/runner/internal/reporting/`
- **CLI Commands**: `report`, `bundle export`, `bundle verify`

### Track M: Tutorial Mode
- **New Directory**: `services/runner/internal/tutorial/`
- **CLI Commands**: `tutorial start`, `tutorial next`, `tutorial status`

### Track N: Plugin Packaging
- **New Directory**: `plugins/`
- **Extends**: `services/runner/internal/plugins/` (existing)
- **CLI Commands**: `plugin pack build`, `plugin pack validate`, `plugin pack install`

### Track O: Fix-it Loop
- **New Directory**: `services/runner/internal/fixit/`
- **CLI Commands**: `fix --dry-run`, `fix --apply`

### Track P: Run Explorer
- **New Directory**: `services/runner/internal/explorer/`
- **CLI Commands**: `explorer`, `runs list`, `runs show`

### Track Q: Release Engineering
- **New Directory**: `scripts/release/`
- **CLI Commands**: `version`, `doctor` (enhanced)

---

## Verification Commands by Track

### Track J Verification
```bash
reachctl recipe list
reachctl recipe run wow
reachctl recipe explain wow
```

### Track K Verification
```bash
# Lint the workflow
node -e "console.log(require('fs').readFileSync('.github/workflows/reach.yml', 'utf8'))"
```

### Track L Verification
```bash
reachctl report <run_id> --format=html
reachctl bundle export <run_id>
reachctl bundle verify <bundle>
```

### Track M Verification
```bash
reachctl tutorial start
reachctl tutorial status
```

### Track N Verification
```bash
reachctl plugin pack validate <plugin>
```

### Track O Verification
```bash
reachctl fix --dry-run <run_id>
```

### Track P Verification
```bash
reachctl runs list
reachctl explorer
```

### Track Q Verification
```bash
reachctl version
reachctl doctor
```

---

## Rollback Procedure

If a merged track causes failures:

1. Identify the failing check: `npm run verify:oss`
2. Isolate the track by reverting its specific files
3. Re-run baseline verification
4. Fix the issue in isolation before re-merging

---

## Communication Protocol

When starting a track:
1. Check this document for current merge status
2. Announce track start in commit message: `[TRACK J] Starting recipe system`
3. Update this document with track progress

When completing a track:
1. Run all pre-merge checks
2. Update this document with completion status
3. Tag commit: `[TRACK J] Complete - Recipe System`

---

## Current Status

| Track | Status | Last Updated |
| :--- | :--- | :--- |
| Phase 0 | In Progress | 2026-02-22 |
| Track J | Pending | - |
| Track K | Pending | - |
| Track L | Pending | - |
| Track M | Pending | - |
| Track N | Pending | - |
| Track O | Pending | - |
| Track P | Pending | - |
| Track Q | Pending | - |

---

## Related Documents

- [`docs/BOUNDARIES.md`](../BOUNDARIES.md)
- [`docs/IMPORT_RULES.md`](../IMPORT_RULES.md)
- [`docs/DETERMINISM_SPEC.md`](../DETERMINISM_SPEC.md)
- [`AGENTS.md`](../../AGENTS.md)
