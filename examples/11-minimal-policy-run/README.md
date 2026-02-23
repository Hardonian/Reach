# Example 11: Minimal Policy Run

**Level:** Beginner | **Time:** 1 min

The simplest possible example of running a pack with policy enforcement.

## What This Demonstrates

- Running a pack through the Reach CLI
- Policy evaluation and enforcement
- Minimal deterministic execution

## Prerequisites

- Reach CLI installed (`reach` or `reachctl` in PATH)
- Node.js 18+ (for the example runner)

## Running

```bash
node examples/11-minimal-policy-run/run.js
```

Or manually:

```bash
# Run the pack directly
reach run minimal-policy-pack

# Or with reachctl directly
reachctl run minimal-policy-pack
```

## Expected Output

```
=== Reach Example 11: Minimal Policy Run ===

Input: {"action": "test", "value": 42}

Running pack with policy enforcement...
✅ Policy allowed: action=test
✅ Execution complete

Run ID: <run-id>
Policy Decision: allow
Next: reach explain <run-id>
```

## Exit Codes

- `0` - Success (policy allowed)
- `4` - Policy blocked
- `1` - Execution error

## Files

- `run.js` - Example runner script
- `pack.json` - Pack definition
- `policy.rego` - Policy rules
- `seed.json` - Input data
