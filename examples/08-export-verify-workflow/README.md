# Example 08: Export Verify Workflow

**Purpose:** Complete workflow for exporting runs, verifying integrity, and importing to another environment.

**Level:** Intermediate  
**Estimated Time:** 5 minutes  
**Requires:** `reach` CLI, Node.js 18+

---

## Quick Run

```bash
node examples/08-export-verify-workflow/run.js
```

---

## What This Example Demonstrates

1. **Run Execution** - Execute a pack locally
2. **Export** - Create portable capsule for sharing
3. **Verify** - Confirm capsule integrity before transfer
4. **Import** - Load capsule in new environment
5. **Replay** - Verify deterministic replay

---

## Manual Steps

### Step 1: Execute a Pack

```bash
./reach run examples/01-quickstart-local/pack.json \
  --input '{"action":"export-test","target":"workflow"}' \
  --json
```

**Save the `run_id` from the JSON output.**

### Step 2: Export to Capsule

```bash
./reach export <run-id> --output my-workflow.reach.zip
```

**Expected output:**

```
✓ Exported run sha256:abc123...
  → ./my-workflow.reach.zip (1.2 MB)
  Contains: meta.json, events.ndjson, artifacts/, policy.json
```

### Step 3: Verify Before Transfer

```bash
./reach verify-proof my-workflow.reach.zip
```

**Expected output:**

```
▶ Verifying my-workflow.reach.zip
✓ Integrity: VALID
✓ Structure: VALID
  Events: 12
  Fingerprint: sha256:def456...
```

### Step 4: Import in New Environment

On the destination machine:

```bash
# Copy the file, then import
./reach import my-workflow.reach.zip
```

**Expected output:**

```
✓ Imported run sha256:abc123...
  Stored at: ~/.reach/runs/sha256:abc123/
  Ready for replay: ./reach replay sha256:abc123
```

### Step 5: Replay and Verify

```bash
./reach replay sha256:abc123 --verbose
```

**Expected output:**

```
▶ Replaying run sha256:abc123
✓ REPLAY_VERIFIED
  Original fingerprint:  sha256:def456
  Replay fingerprint:    sha256:def456
  Events replayed: 12
```

---

## Cross-Environment Workflow

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Machine A     │         │   Transfer      │         │   Machine B     │
│                 │         │                 │         │                 │
│ 1. Run pack     │────────►│ 3. Copy         │────────►│ 4. Import       │
│ 2. Export       │         │    .reach.zip   │         │ 5. Replay       │
│                 │         │                 │         │ 6. Verify       │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## Files

| File                    | Purpose                   |
| ----------------------- | ------------------------- |
| `run.js`                | Full workflow automation  |
| `source-run.json`       | Sample run configuration  |
| `expected-results.json` | Expected workflow outputs |

---

## Expected Results

```
=== Export Verify Workflow ===

1. Running pack...
   ✓ Run complete
   Run ID: sha256:...
   Fingerprint: sha256:...

2. Exporting to capsule...
   ✓ Export complete
   File: my-workflow.reach.zip
   Size: 1.2 MB

3. Verifying capsule...
   ✓ Integrity: VALID
   ✓ Structure: VALID
   Events: 12

4. Simulating import...
   ✓ Import ready
   Location: ~/.reach/runs/...

5. Replay verification...
   ✓ REPLAY_VERIFIED
   Fingerprint match: YES

Workflow Status: ✓ COMPLETE
Portability:     ✓ VERIFIED
Determinism:     ✓ CONFIRMED
```

---

## Automation Use Cases

### CI/CD Artifact Handoff

```bash
# CI: Export successful runs
./reach export $RUN_ID --output build-$BUILD_ID.reach.zip

# CD: Import and replay for verification
./reach import build-$BUILD_ID.reach.zip
./reach replay $RUN_ID
```

### Audit Trail Sharing

```bash
# Export with audit metadata
./reach export $RUN_ID --output audit-$(date +%Y%m%d).reach.zip
# Transfer to audit system
# Verify on audit system
```

---

## Key Takeaways

- Capsules are self-contained and portable
- Verification ensures integrity during transfer
- Replay confirms determinism across environments
- No external dependencies needed for import/replay

---

## What To Try Next

1. Export with `--sign` for cryptographic attestation
2. Compare fingerprints across different machines
3. Try [Tamper Detection](../07-verify-tamper-detection/) to understand integrity
