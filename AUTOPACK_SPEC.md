# Reach Autopack Specification

## Overview

Autopack is Reach's community-scale engine for pack quality assurance, automated documentation, and registry validation. It enables npm-scale pack ecosystems without ecosystem rot through automated scoring and CI gates.

## Design Principles

1. **OSS-first**: PR-based registry contributions, no centralized service required
2. **Determinism-preserving**: All existing determinism/policy/signing/audit/replay unchanged
3. **Minimal dependencies**: Self-contained Go implementation
4. **Badge-based**: Quality communicated via standardized badges

## Scoring Rubric

### 1. Determinism Score (0-100)

Measures pack reproducibility and replay fidelity.

| Criteria | Weight | Description |
|----------|--------|-------------|
| Hash Stability | 40% | Run hash consistent across multiple executions |
| Replay Success | 40% | Replay produces identical results |
| Spec Compliance | 20% | Correct spec_version and deterministic flag |

**Calculation:**
```
determinism_score = (hash_stability * 0.4) + (replay_success * 0.4) + (spec_compliance * 0.2)
```

### 2. Policy Hygiene Score (0-100)

Measures adherence to principle of least privilege.

| Criteria | Weight | Description |
|----------|--------|-------------|
| Declaration Accuracy | 50% | Tools used match tools declared |
| Permission Scope | 30% | Permissions are minimal for functionality |
| Policy Contract | 20% | Policy file valid and covers declared permissions |

**Calculation:**
```
policy_score = (declaration_accuracy * 0.5) + (permission_scope * 0.3) + (policy_contract * 0.2)
```

### 3. Supply Chain Score (0-100)

Measures trustworthiness and provenance.

| Criteria | Weight | Description |
|----------|--------|-------------|
| Signature Valid | 40% | Pack has valid cryptographic signature |
| Author Verified | 30% | Author identity verified (if registry supports) |
| Reproducible Build | 30% | Pack can be rebuilt from source |

**Calculation:**
```
supply_chain_score = (signature_valid * 0.4) + (author_verified * 0.3) + (reproducible_build * 0.3)
```

### 4. Performance Score (0-100)

Measures execution efficiency on standard fixtures.

| Criteria | Weight | Description |
|----------|--------|-------------|
| Cold Start Latency | 40% | Time to first output |
| Execution Time | 40% | Total execution time on fixture |
| Memory Efficiency | 20% | Peak memory usage vs baseline |

**Calculation:**
```
performance_score = (cold_start_score * 0.4) + (execution_score * 0.4) + (memory_score * 0.2)
```

## Badge Rules

### Overall Quality Badges

| Badge | Condition | Display |
|-------|-----------|---------|
| 🏆 Gold | All scores ≥ 90 | `![Gold](https://img.shields.io/badge/quality-gold-yellow)` |
| 🥈 Silver | All scores ≥ 75, at least one ≥ 90 | `![Silver](https://img.shields.io/badge/quality-silver-lightgrey)` |
| 🥉 Bronze | All scores ≥ 60 | `![Bronze](https://img.shields.io/badge/quality-bronze-orange)` |
| ⚠️ Needs Work | Any score < 60 | `![Needs Work](https://img.shields.io/badge/quality-needs%20work-red)` |

### Category Badges

| Category | Badge | Condition |
|----------|-------|-----------|
| Determinism | 🔒 Deterministic | Score ≥ 90 |
| Determinism | ⚠️ Variable | Score < 90 |
| Policy | 🛡️ Minimal | Score ≥ 90 |
| Policy | ⚠️ Permissive | Score < 90 |
| Supply Chain | ✅ Verified | Score ≥ 90 |
| Supply Chain | ❌ Unverified | Score < 90 |
| Performance | 🚀 Fast | Score ≥ 90 |
| Performance | 🐢 Slow | Score < 60 |

### Verified Badges

| Badge | Condition |
|-------|-----------|
| ✓ Registry Verified | Passed all CI gates |
| ✓ Replay Tested | Replay score = 100 |
| ✓ Community Review | 3+ community approvals |

## CLI Commands

### `reach pack score <path>`

Runs full scoring suite on a pack.

```bash
# Score a local pack
reach pack score ./my-pack

# Output JSON for CI
reach pack score ./my-pack --json

# Score with specific fixtures
reach pack score ./my-pack --fixtures ./fixtures

# Generate badge report
reach pack score ./my-pack --badges
```

Output:
```json
{
  "pack_id": "com.example.pack",
  "version": "1.0.0",
  "scores": {
    "determinism": 95,
    "policy_hygiene": 88,
    "supply_chain": 72,
    "performance": 91
  },
  "overall": 86.5,
  "grade": "silver",
  "badges": ["🥈 Silver", "🔒 Deterministic", "🛡️ Minimal", "🚀 Fast"],
  "details": { ... }
}
```

### `reach pack docs <path>`

Generates documentation for a pack.

```bash
# Generate markdown docs
reach pack docs ./my-pack --output ./docs

# Include scoring results
reach pack docs ./my-pack --with-scores

# Generate for registry
reach pack docs ./my-pack --registry-format
```

## CI Gates

### `verify:registry-pr`

GitHub Action workflow for registry PR validation.

```yaml
name: Registry PR Validation
on:
  pull_request:
    paths:
      - 'packs/**'
      - 'registry/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Reach
        uses: reach/setup-action@v1
      - name: Validate Registry PR
        run: reach verify:registry-pr
```

### Validation Steps

1. **Schema Validation**
   - Metadata schema compliance
   - Required fields present
   - Version format valid

2. **Lint Check**
   - Run `reach pack lint`
   - No errors allowed
   - Warnings logged but allowed

3. **Fixture Harness**
   - Run pack against standard fixtures
   - Verify outputs match expectations
   - Check determinism markers

4. **Scoring**
   - Compute all category scores
   - Minimum overall score: 60 (Bronze)
   - Packs < 60 require maintainer override

5. **Documentation**
   - Verify README.md exists
   - Check for usage examples
   - Validate pack.json descriptions

6. **Policy Review**
   - Policy contract must parse
   - No high-risk permissions without justification
   - Default deny must be set

## Registry Structure

```
registry/
├── packs/
│   ├── com.example.pack/
│   │   ├── 1.0.0/
│   │   │   ├── pack.json
│   │   │   ├── README.md
│   │   │   └── scores.json
│   │   └── 1.1.0/
│   └── org.another.pack/
├── index.json           # Registry index
└── badges/              # Generated badge images
```

## API Reference

### Score Report Format

```go
type ScoreReport struct {
    PackID      string            `json:"pack_id"`
    Version     string            `json:"version"`
    Timestamp   time.Time         `json:"timestamp"`
    Scores      CategoryScores    `json:"scores"`
    Overall     float64           `json:"overall"`
    Grade       string            `json:"grade"`
    Badges      []string          `json:"badges"`
    Issues      []ScoreIssue      `json:"issues,omitempty"`
}

type CategoryScores struct {
    Determinism    int `json:"determinism"`
    PolicyHygiene  int `json:"policy_hygiene"`
    SupplyChain    int `json:"supply_chain"`
    Performance    int `json:"performance"`
}
```

### Documentation Format

```go
type PackDocs struct {
    Metadata    PackMetadata   `json:"metadata"`
    README      string         `json:"readme"`
    Scores      *ScoreReport   `json:"scores,omitempty"`
    Examples    []Example      `json:"examples"`
    Badges      []Badge        `json:"badges"`
}
```
