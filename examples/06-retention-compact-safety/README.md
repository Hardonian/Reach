# Example 06: Retention Compact Safety

**Purpose:** Run retention status → compact (safe mode) → verify integrity still passes. Learn data lifecycle management.

**Level:** Advanced  
**Estimated Time:** 4 minutes

## Quick Run

```bash
node examples/06-retention-compact-safety/run.js
```

## What This Example Demonstrates

1. **Retention Analysis** - Understanding data age and policy
2. **Safe Compaction** - Removing old data while preserving integrity
3. **Chain Verification** - Ensuring no evidence is broken
4. **Space Recovery** - Measuring storage reclaimed
5. **Audit Trail** - Maintaining compliance records

## Retention Policies

```
┌─────────────────────────────────────────────────────────────┐
│                    RETENTION TIERS                          │
├─────────────┬──────────────┬────────────────────────────────┤
│   Tier      │   Duration   │   Action                       │
├─────────────┼──────────────┼────────────────────────────────┤
│ Hot         │ 0-7 days     │ Full detail, fast query        │
│ Warm        │ 7-30 days    │ Summarized, occasional access  │
│ Cold        │ 30-90 days   │ Compressed, rare access        │
│ Archive     │ 90+ days     │ Hash only, compliance          │
└─────────────┴──────────────┴────────────────────────────────┘
```

## Expected Output

```
=== Retention Compact Safety ===

Retention Status:
  Total runs: 1,250
  Hot (0-7d): 45
  Warm (8-30d): 180
  Cold (31-90d): 525
  Archive (>90d): 500

Policy Check:
  Policy: retention-conservative
  Archive after: 90 days
  Compliant: ✅ YES

Compaction:
  Mode: SAFE
  Target: Archive tier runs
  Preserved: Fingerprints, metadata
  Removed: Event details, logs

Integrity Check:
  Chain hash: ✅ VALID
  Evidence refs: ✅ INTACT
  Replay possible: ✅ YES (for non-archived)

Space Recovered:
  Before: 2.5 GB
  After: 1.8 GB
  Saved: 0.7 GB (28%)

Compliance:
  Audit trail: ✅ COMPLETE
  Retention proof: ✅ VALID
```

## Files

| File                    | Purpose                       |
| ----------------------- | ----------------------------- |
| `retention-policy.json` | Retention rules configuration |
| `mock-database.json`    | Simulated run database        |
| `expected-compact.json` | Expected compaction results   |
| `run.js`                | Retention workflow runner     |

## Safe Compaction Rules

1. **Never delete fingerprints** - Determinism proofs are permanent
2. **Preserve metadata** - Run IDs, timestamps, tags remain
3. **Summarize evidence** - Replace details with hashes
4. **Maintain chains** - All references stay valid
5. **Audit everything** - Log all compaction actions

## What To Try Next

1. Try `retention-aggressive` policy for more compaction
2. Test replay of archived runs (should still work with summary)
3. Review [Example 01](../01-quickstart-local/) with fresh understanding
