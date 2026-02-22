# Decision Engine Harvest Plan

## Overview

Extract Zeolite quant decision primitives into Reach as a clean, tested Rust crate.
This module provides a lightweight, production-grade decision engine for robust
decision-making under uncertainty.

Based on the Zeolite TypeScript codebase (commits 40485d2, 52f4007, e6f2ebb).

## Harvest Set

### Core Algorithms to Extract

1. **Flip Distance Computation** (`deriveFlipDistances()`)
   - Source: `zeolite-core.ts:84-92`
   - Sensitivity analysis for decision boundaries
   - Computes how much each assumption must change to alter the top action
   - Sorted by flip distance for deterministic ordering

2. **VOI-Based Evidence Ranking** (`deriveVoiRankings()`)
   - Source: `zeolite-core.ts:94-108`
   - Value of Information calculation for evidence prioritization
   - Cost-adjusted information gain scoring
   - Recommendation classification (do_now, plan_later, defer)

3. **Regret-Bounded Planning** (`generate_regret_bounded_plan`)
   - Source: `zeolite-core.ts:199-222`
   - Horizon-limited action selection
   - Monotonic improvement verification
   - Stop condition evaluation

4. **Decision Boundary Explanation** (`explain_decision_boundary`)
   - Source: `zeolite-core.ts:224-235`
   - Top action identification
   - Nearest flip analysis

### Determinism Utilities

1. **Stable ID Generation** (`stableId()`)
   - Source: `zeolite-core.ts:26-28`
   - SHA-256 hash truncated to 16 hex chars
   - Deterministic ID from any string input

2. **Canonical JSON Serialization**
   - Sorted object keys deeply
   - Float normalization (toFixed for consistent representation)

### Types to Define

From the TypeScript interfaces, we need Rust equivalents for:

- `DecisionSpec` - Decision problem specification
- `EvidenceEvent` - Evidence submission record
- `ActionOption` - Available action with properties
- `Scenario` - Possible outcome scenario
- `FlipDistance` - Sensitivity metric result
- `VoiRanking` - Evidence priority ranking
- `RegretBoundedPlan` - Plan with horizon limits

### Not Extracted (Out of Scope)

- Context management (in-memory state) - Will use stateless design
- Transcript operations - Belongs in engine-core
- LLM integration - Not part of quant layer
- UI/dashboard components - Not part of core

## Implementation Plan

### Phase 1: Core Types (`types.rs`)
- Define all input/output types with Serde serialization
- Ensure deterministic serialization (sorted keys)

### Phase 2: Determinism Module (`determinism.rs`)
- `stable_hash()` - SHA-256 based deterministic hashing
- `canonicalize_json()` - Sorted key serialization
- `normalize_float()` - Consistent rounding to 1e-9 precision

### Phase 3: Decision Algorithms (`engine.rs`)
- `compute_flip_distances()` - Sensitivity analysis
- `rank_evidence_by_voi()` - VOI-based prioritization
- `generate_regret_bounded_plan()` - Horizon-limited planning
- `explain_decision_boundary()` - Boundary explanation

### Phase 4: Integration (`lib.rs`)
- `evaluate_decision()` - Main entry point combining all algorithms
- Composite scoring with configurable weights

## Dependencies

- `serde` - Serialization
- `serde_json` - JSON handling
- `sha2` - Hashing (Rust crypto crate)

## Provenance

- **Source**: Zeolite TypeScript codebase (commits 40485d2, 52f4007, e6f2ebb)
- **License**: MIT (consistent with Reach license)
- **Transformation**: TypeScript → Rust for strong determinism guarantees

## Verification Criteria

1. Identical input → identical output (byte-stable JSON)
2. All tests pass with `cargo test`
3. No clippy warnings with `cargo clippy -- -D warnings`
4. Build succeeds with `cargo build`
