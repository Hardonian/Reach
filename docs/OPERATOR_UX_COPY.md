# Operator UX Copy Blocks

> **Version:** 1.2
> **Status:** Production
> **Last Updated:** 2026-02-27

Exact wording proposals for Reach CLI operator-facing output.

---

## 1. `reach doctor` Output Sections

### 1.1 Header Section

```
╔══════════════════════════════════════════════════════════════╗
║  Reach Doctor - System Diagnostics                          ║
║  Version: 1.2.0 | Engine: Requiem v1.2.0                  ║
╚══════════════════════════════════════════════════════════════╝
```

### 1.2 Engine Status Section

```
┌─────────────────────────────────────────────────────────────┐
│ ENGINE                                                      │
├─────────────────────────────────────────────────────────────┤
│ Binary:     /path/to/requiem                    [✓] OK     │
│ Version:    v1.2.0                               [✓] OK     │
│ Protocol:   v1.0 ↔ v1.0                            [✓] OK     │
│ Determinism: 5/5 runs matched                        [✓] OK     │
│ Security:   symlink protection, env sanitization    [✓] OK     │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 CAS Status Section

```
┌─────────────────────────────────────────────────────────────┐
│ CAS (Content Addressable Storage)                           │
├─────────────────────────────────────────────────────────────┤
│ Status:     Healthy                                         │
│ Blobs:      1,234 (2.3 GB)                                 │
│ Integrity:  All verified                                     │
│ Eviction:   Auto-enabled (LRU, max 10GB)                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Queue Status Section

```
┌─────────────────────────────────────────────────────────────┐
│ EXECUTION QUEUE                                             │
├─────────────────────────────────────────────────────────────┤
│ Capacity:   100 / 100                               [!] busy │
│ Running:    3                                          │
│ Pending:   97                                          │
│ Oldest:    12.3s                                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.5 Security Status Section

```
┌─────────────────────────────────────────────────────────────┐
│ SECURITY                                                    │
├─────────────────────────────────────────────────────────────┤
│ Workspace:  /path/to/workspace                   [✓] OK    │
│ Symlinks:   Blocked (escape prevention)           [✓] OK    │
│ Env filter:  Enabled (14 patterns)                [✓] OK    │
│ Binary:     Verified                               [✓] OK    │
└─────────────────────────────────────────────────────────────┘
```

### 1.6 Summary Section

```
═══════════════════════════════════════════════════════════════
[OK] All systems operational
    - Engine: Ready
    - CAS: Healthy
    - Queue: Busy (97 pending)
    - Security: Enabled

Run 'reach doctor --verbose' for detailed output
Run 'reach doctor --bundle' to generate debug bundle
═══════════════════════════════════════════════════════════════
```

---

## 2. `reach diag/bugreport` Disclaimers

### 2.1 Initial Disclaimer (shown before bundle creation)

```
⚠️  DEBUG BUNDLE - REVIEW BEFORE SHARING

This bundle contains diagnostic information including:
- Version info (Reach, engine, Node, Rust, OS)
- Configuration (sanitized - secrets/redacted)
- Recent run fingerprints
- Protocol debug state

BEFORE SHARING:
1. Review files in the bundle
2. Redact any sensitive data (tokens, keys, paths)
3. Do NOT share raw logs with external parties

To add custom redactions:
  reach doctor --bundle --redact-patterns="your-pattern"
```

### 2.2 Bundle Created Confirmation

```
[✓] Debug bundle created: reach-debug-20260227-143022.zip

Contents (review before sharing):
  - version.txt
  - engine-info.json
  - config-dump.json (secrets redacted)
  - determinism-logs/
  - recent-runs/ (last 5, truncated)
  - system-info.json

Next steps:
1. Review bundle contents
2. Redact sensitive data if needed
3. Share via secure channel
```

### 2.3 Redaction Notice

```
🔒 DEFAULT REDACTIONS APPLIED

The following patterns are automatically redacted:
  - *TOKEN, *SECRET, *KEY, AUTH*, COOKIE*
  - REACH_ENCRYPTION_KEY
  - AWS_*, GCP_*, AZURE_*
  - Bearer tokens, Basic auth
  - Private keys, certificates

To check redactions:
  reach doctor --bundle --dry-run
```

---

## 3. Rollback Messaging

### 3.1 Force Rust Engine Warning

```
⚠️  ENGINE ROLLBACK

FORCE_RUST environment variable detected.
Switching from Requiem (C++) to Rust engine.

WARNING:
- Rust engine may have different determinism characteristics
- Some features may not be available
- Performance may differ from Requiem

This is a rollback configuration. Not recommended for production.
Use only for debugging or if Requiem has issues.
```

### 3.2 Force Requiem Engine Message

```
ℹ️  Using Requiem engine (FORCE_REQUIEM detected)
    Version: v1.2.0
    Protocol: v1.0
```

### 3.3 Protocol Version Pinning Message

```
ℹ️  Protocol version pinned via REACH_PROTOCOL_VERSION=1.0

Negotiation disabled. Using fixed version.
This is useful for:
- Reproducing specific behavior
- Debugging protocol issues
- CI environment stability

Note: If engine version doesn't support pinned version,
connection will fail with ERR_PROTOCOL_VERSION_MISMATCH
```

### 3.4 Rollback Complete Message

```
✅ Rollback complete

Engine: Rust (via FORCE_RUST)
Protocol: auto-negotiate
Determinism: Verify with 'reach verify:determinism'

To revert:
  unset FORCE_RUST
  pnpm verify:smoke
```

---

## 4. Queue/Backpressure Errors

### 4.1 Queue Full Error

```
╔══════════════════════════════════════════════════════════════╗
║ ERROR: ERR_QUEUE_FULL                                      ║
╚══════════════════════════════════════════════════════════════╝

The execution queue is at capacity (100/100).

Current state:
  Queue depth:  100
  Running:      10
  Pending:      90
  Oldest wait:  45.2s

WHAT THIS MEANS:
- All execution slots are occupied
- Your request is queued behind 90 others
- Wait time may exceed 45 seconds

WHAT TO DO:
1. Wait for pending executions to complete
2. Reduce concurrent requests from your client
3. Increase queue capacity: REACH_QUEUE_SIZE=200
4. Check for stuck executions: reach ps

If this persists, consider:
- Running executions in batches
- Using priority queue (if available)
- Scaling horizontally with multiple daemon instances
```

### 4.2 Backpressure Warning (Pre-emptive)

```
⚠️  BACKPRESSURE WARNING

Queue at 80% capacity (80/100)

If queue fills completely, new requests will be rejected.
Consider:
- Throttling client requests
- Waiting for pending executions to complete
```

### 4.3 Queue Recovery Message

```
ℹ️  Queue capacity available: 45/100

Backpressure cleared. Normal operation resumed.
```

---

## 5. Determinism Drift Detection

### 5.1 Drift Detected Error

```
╔══════════════════════════════════════════════════════════════╗
║ ERROR: ERR_DETERMINISM_MISMATCH                             ║
╚══════════════════════════════════════════════════════════════╝

Fingerprint mismatch detected during replay verification.

Original:  a1b2c3d4e5f6g7h8...
Replayed:  9a8b7c6d5e4f3g2h1...

LIKELY CAUSES:
1. Non-deterministic code in policy (Math.random, Date.now)
2. Floating-point operations (use fixed-point)
3. Different environment variables
4. Race conditions in execution

DIAGNOSTIC STEPS:
1. Run: reach verify:determinism --runs=10 --verbose
2. Check: reach doctor --scan-determinism
3. Review policy for non-deterministic sources

FOR CI DRIFT:
- Ensure REACH_DETERMINISM_SEED is set
- Pin Node/Rust versions
- Review environment differences
```

---

## 6. CAS Integrity Failure

### 6.1 CAS Integrity Error

```
╔══════════════════════════════════════════════════════════════╗
║ ERROR: ERR_CAS_INTEGRITY                                     ║
╚══════════════════════════════════════════════════════════════╝

CAS blob integrity check failed.

CID:         bafybeic7rx2o3...
Stored hash: deadbeef1234...
Computed:    feedface5678...

POSSIBLE CAUSES:
1. Blob was corrupted on disk
2. Blob was modified after storage
3. Blob was evicted (if using LRU)
4. Storage backend issue

DIAGNOSTIC STEPS:
1. Check CAS health: reach doctor --cas
2. Verify blob: reach cas verify <cid>
3. Check storage: reach doctor --storage

RECOVERY OPTIONS:
- Re-fetch from source (if available): reach cas fetch <cid>
- Re-run to regenerate: reach run <pack> --regenerate
- Restore from backup (if available)
```
