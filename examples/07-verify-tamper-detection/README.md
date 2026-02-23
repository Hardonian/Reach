# Example 07: Verify Tamper Detection

**Purpose:** Demonstrate how Reach detects tampering with execution artifacts through cryptographic verification.

**Level:** Intermediate  
**Estimated Time:** 5 minutes  
**Requires:** `reach` CLI, Node.js 18+

---

## Quick Run

```bash
node examples/07-verify-tamper-detection/run.js
```

---

## What This Example Demonstrates

1. **Export Integrity** - Create a portable capsule from a run
2. **Verification** - Confirm the capsule is valid
3. **Tamper Detection** - Modify a file and watch verification fail
4. **Diagnostic Output** - Understand what failed and why

---

## Manual Steps

### Step 1: Run a Pack

```bash
./reach run examples/01-quickstart-local/pack.json \
  --input '{"action":"test","target":"integrity"}'
```

**Expected output:**
```
▶ Running pack 'quickstart-local'
  run_id: sha256:abc123...
  policy: strict-default v1
✓ Completed in 245ms
  fingerprint: sha256:def456...
```

Save the `run_id` for the next step.

### Step 2: Export the Run

```bash
./reach export <run-id> --output capsule-intact.reach.zip
```

**Expected output:**
```
✓ Exported run sha256:abc123...
  → ./capsule-intact.reach.zip (1.2 MB)
  Contains: meta.json, events.ndjson, artifacts/, policy.json
```

### Step 3: Verify Intact Capsule

```bash
./reach verify-proof capsule-intact.reach.zip
```

**Expected output:**
```
▶ Verifying capsule-intact.reach.zip
✓ Integrity: VALID
✓ Structure: VALID
✓ Signatures: N/A (unsigned)
  Events: 12
  Fingerprint: sha256:def456...
```

### Step 4: Simulate Tampering

Create a tampered copy and modify it:

```bash
# Copy the capsule
cp capsule-intact.reach.zip capsule-tampered.reach.zip

# Extract, modify, repack (using unzip/zip)
unzip -q capsule-tampered.reach.zip -d tampered/
echo "tampered" >> tampered/meta.json
zip -r capsule-tampered.reach.zip tampered/
```

### Step 5: Detect Tampering

```bash
./reach verify-proof capsule-tampered.reach.zip
```

**Expected output:**
```
▶ Verifying capsule-tampered.reach.zip
✗ Integrity: FAILED
  Hash mismatch in: meta.json
  Expected: sha256:abc...
  Actual:   sha256:xyz...
✗ Verification failed
```

---

## Files

| File | Purpose |
|------|---------|
| `run.js` | Automated demonstration script |
| `pack.json` | Minimal pack for testing (references 01-quickstart-local) |
| `expected.json` | Expected verification results |

---

## Expected Results

Running the example produces:

```
=== Tamper Detection Demo ===

1. Running pack...
   Run ID: sha256:...
   Fingerprint: sha256:...

2. Exporting capsule...
   File: capsule-intact.reach.zip
   ✓ Export successful

3. Verifying intact capsule...
   ✓ Integrity check passed

4. Simulating tampering...
   Modified: meta.json

5. Verifying tampered capsule...
   ✗ Integrity check failed (expected)
   Tamper detected in: meta.json

=== Summary ===
Intact capsule:   ✓ VALID
Tampered capsule: ✗ DETECTED
Determinism:      ✓ VERIFIED
```

---

## Key Takeaways

- Every exported capsule contains cryptographic fingerprints
- Any modification invalidates the integrity hash
- Verification identifies which component was modified
- This enables audit trails and non-repudiation

---

## What To Try Next

1. Sign capsules with a private key for additional security
2. Try the [Export Verify Replay example](../05-export-verify-replay/)
3. Explore [Presets Dry Run](../09-presets-dry-run/) for configuration testing
