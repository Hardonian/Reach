# Example 10: Offline Demo Report Generation

**Purpose:** Generate comprehensive diagnostic reports without network connectivity.

**Level:** Beginner  
**Estimated Time:** 2 minutes  
**Requires:** `reach` CLI, Node.js 18+

---

## Quick Run

```bash
node examples/10-offline-demo-report/run.js
```

Or manually:

```bash
./reach report demo
```

---

## What This Example Demonstrates

1. **Offline Generation** - Create reports without network access
2. **Environment Snapshot** - Capture system state for debugging
3. **Example Execution** - Run built-in examples and capture output
4. **Integrity Verification** - Verify report hasn't been tampered with

---

## Manual Steps

### Step 1: Generate Demo Report

```bash
./reach report demo
```

**Expected output:**
```
Generating demo report in: demo-report/
✓ Demo report generated successfully
  Location: demo-report/
  Report ID: demo-xyz123
  Integrity: abc123def456...

To verify:
  ./reach report verify demo-report/
```

### Step 2: Explore Generated Files

```bash
ls -la demo-report/
```

**Output:**
```
demo-report/
├── manifest.json      # Report metadata and integrity hash
├── timeline.json      # Available examples and their status
├── env.json          # Environment snapshot (sanitized)
├── index.md          # Human-readable summary
└── outputs/
    └── example-01.json  # Output from example execution
```

### Step 3: View Human-Readable Summary

```bash
cat demo-report/index.md
```

**Contains:**
- Report ID and generation timestamp
- Environment details (versions, platform)
- Integrity hash for verification
- Available examples with run commands
- Verification instructions

### Step 4: Verify Report Integrity

```bash
./reach report verify demo-report/
```

**Expected output:**
```
▶ Verifying demo report: demo-report/
✓ Manifest: VALID
✓ Integrity hash: MATCH
✓ Timeline: VALID
✓ Outputs: VALID

Report ID: demo-xyz123
Generated: 2026-02-23T15:30:00Z
Status: ✓ VERIFIED
```

---

## Report Contents

### manifest.json

```json
{
  "generatedAt": "2026-02-23T15:30:00Z",
  "reachVersion": "0.3.1",
  "environment": {
    "node": "v20.11.0",
    "platform": "linux",
    "arch": "x64",
    "versions": {
      "go": "1.22.7",
      "rust": "1.75.0"
    }
  },
  "manifest": {
    "reportId": "demo-xyz123",
    "schemaVersion": "1.0.0",
    "integrityHash": "abc123..."
  }
}
```

### env.json

Sanitized environment data suitable for sharing:
- Node.js version
- Platform and architecture
- Go/Rust versions (if available)
- No secrets or personal information

### timeline.json

List of available examples with commands:
```json
[
  {
    "type": "example",
    "name": "01-quickstart-local",
    "status": "available",
    "command": "node examples/01-quickstart-local/run.js"
  }
]
```

---

## Files

| File | Purpose |
|------|---------|
| `run.js` | Automated report generation demo |
| `expected-structure.json` | Expected report file structure |

---

## Expected Results

```
=== Offline Demo Report Generation ===

1. Generating demo report...
   ✓ Report generated
   Location: demo-report/
   Report ID: demo-xyz123
   Integrity: abc123def456...

2. Exploring generated files...
   ✓ manifest.json      (metadata)
   ✓ timeline.json      (examples)
   ✓ env.json          (environment)
   ✓ index.md          (summary)
   ✓ outputs/          (execution results)

3. Environment snapshot...
   Node.js:    v20.11.0
   Platform:   linux
   Go:         1.22.7
   Rust:       1.75.0

4. Verifying integrity...
   ✓ Manifest: VALID
   ✓ Hash: MATCH
   Status: VERIFIED

=== Summary ===
Offline capable: ✓ YES
Network required: ✗ NO
Report contents: Environment, examples, execution output
Use case: Bug reports, system diagnostics, onboarding verification
```

---

## Use Cases

### Bug Reports

Attach `demo-report/manifest.json` to bug reports for environment context:

```bash
./reach report demo
cat demo-report/manifest.json
# Copy contents into bug report
```

### System Diagnostics

Verify installation completeness:

```bash
./reach report demo
./reach report verify demo-report/
```

### Onboarding Verification

New users can confirm their setup:

```bash
./reach doctor          # Quick health check
./reach report demo     # Detailed verification
./reach report verify demo-report/  # Confirm integrity
```

### Air-Gapped Environments

Generate reports without internet:

```bash
# Works offline - no network calls
./reach report demo --output /media/usb/diagnostic-report/
```

---

## Key Takeaways

- Report generation works completely offline
- Contains sanitized environment data only (no secrets)
- Integrity hash enables tamper detection
- Useful for bug reports and system diagnostics

---

## What To Try Next

1. Generate a report and attach to a test bug report
2. Compare environment snapshots across different machines
3. Try the [Export Verify Workflow](../08-export-verify-workflow/) to share reports
