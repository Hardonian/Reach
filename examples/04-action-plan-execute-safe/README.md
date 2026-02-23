# Example 04: Action Plan Execute (Safe)

**Purpose:** Accept decision → plan → approve → execute SAFE action → journal → events. Full workflow demonstration.

**Level:** Intermediate  
**Estimated Time:** 5 minutes

## Quick Run

```bash
node examples/04-action-plan-execute-safe/run.js
```

## What This Example Demonstrates

1. **Decision Acceptance** - Taking a selected decision from a junction
2. **Planning** - Breaking decision into executable steps
3. **Approval** - Human or policy-based approval gates
4. **Safe Execution** - Deterministic action execution
5. **Journaling** - Recording all events in order
6. **Event Emission** - Structured events for external systems

## Workflow

```
Decision ──► Plan ──► Approve ──► Execute ──► Journal ──► Events
   │           │          │           │          │          │
   │           │          │           │          │          └── event.log
   │           │          │           │          └── journal.json
   │           │          │           └── action_result.json
   │           │          └── approval_record.json
   │           └── plan.json
   └── decision.json
```

## Expected Output

```
=== Action Plan Execute (Safe Mode) ===
Decision: scale-up-service
Plan steps: 4
Approval: AUTO-APPROVED (safe actions only)

Executing:
  1. validate_resources ✅
  2. check_quotas ✅
  3. scale_replicas (dry-run) ✅
  4. verify_health (dry-run) ✅

Journal: 8 events recorded
Events emitted: 4
Fingerprint: <sha256>
```

## Safe Actions Only

This example uses only SAFE actions (no side effects):
- `validate_resources` - Read-only validation
- `check_quotas` - Read-only quota check
- `scale_replicas (dry-run)` - Simulation mode
- `verify_health (dry-run)` - Simulation mode

## Files

| File | Purpose |
|------|---------|
| `decision.json` | Decision to execute |
| `plan.json` | Action plan with steps |
| `actions/` | Safe action definitions |
| `expected-events.json` | Expected event structure |
| `run.js` | Workflow runner |

## What To Try Next

1. Modify the plan to include different actions
2. Add approval policies that require human review
3. Try [Example 05: Export Verify Replay](../05-export-verify-replay/)
