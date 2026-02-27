# Reach Troubleshooting Guide

> **Version:** 1.2  
> **Status:** Production  
> **Last Updated:** 2026-02-27

Common failure modes, exact diagnostic steps, and remediation procedures for Reach with Requiem engine.

---

## 1. Installation Failures

### Engine Binary Not Found

**Symptom:**
```
Error: ERR_ENGINE_NOT_FOUND: Requiem binary not found at /path/to/requiem
```

**Cause:** Rust engine not compiled, or binary moved/deleted.

**Diagnosis:**
```bash
ls -la crates/requiem/target/release/requiem
reach doctor --engine
```

**Fix:**
```bash
# Rebuild engine
pnpm -r --filter requiem build

# Or full rebuild
pnpm clean && pnpm install && pnpm -r build
```

---

### Node.js Version Mismatch

**Symptom:**
```
Error: ERR_INVALID_NODE_VERSION: Node.js 16.x detected, requires 18+
```

**Cause:** Node.js version too old.

**Fix:**
```bash
# Check current version
node --version

# Use nvm to switch version
nvm install 20
nvm use 20

# Or use volta/pnpm to manage
volta install node@20
```

---

### pnpm Workspace Error

**Symptom:**
```
Error: ERR_PNPM_WORKSPACE: pnpm-workspace.yaml not found
```

**Cause:** Not running from project root, or workspace config corrupted.

**Fix:**
```bash
# Ensure at project root
cd /path/to/decision-engine
ls pnpm-workspace.yaml

# If missing, restore from git
git checkout pnpm-workspace.yaml
```

---

## 2. Engine Failures

### Determinism Mismatch

**Symptom:**
```
Error: ERR_DETERMINISM_MISMATCH: Fingerprint mismatch after replay
  Expected: a1b2c3d4e5f6...
  Actual:   7f8e9d0c1b2a...
```

**Cause:** Non-deterministic operation in execution path, floating-point variation, or random values.

**Diagnosis:**
```bash
# Run deterministic check with verbose output
reach verify:determinism --runs=10 --verbose

# Check for non-deterministic sources
reach doctor --scan-determinism
```

**Fix:**
1. Check for `Math.random()`, `Date.now()`, or UUID generation in policy/code
2. Verify fixed-point math is used (not floating-point)
3. Ensure canonical serialization order
4. Pin environment variables that might affect timing

**If false positive:** Check if input contains timestamps or dynamic data. Use deterministic equivalents.

---

### CAS Integrity Failure

**Symptom:**
```
Error: ERR_CAS_INTEGRITY: Stored hash does not match computed hash
  CID: bafybeic7rx...
  Expected: deadbeef...
  Actual:  feedface...
```

**Cause:** CAS blob corrupted, modified, or evicted.

**Diagnosis:**
```bash
# Check CAS health
reach doctor --cas

# List CAS contents
reach cas ls

# Verify specific CID
reach cas verify bafybeic7rx...
```

**Fix:**
```bash
# If blob evicted, re-fetch if available
reach cas fetch bafybeic7rx...

# If corrupted, may need to re-run
reach run <pack> --regenerate

# If persistent, check disk health
smartctl -a /dev/disk
```

---

### Protocol Version Mismatch

**Symptom:**
```
Error: ERR_PROTOCOL_VERSION: Client v1.1, Server v1.0 - cannot negotiate
```

**Cause:** CLI and engine have incompatible protocol versions.

**Diagnosis:**
```bash
reach doctor --protocol
```

**Fix:**
```bash
# Pin to compatible version
REACH_PROTOCOL_VERSION=1.0 reach run <pack>

# Or upgrade engine to match CLI
pnpm -r --filter requiem build
```

---

## 3. Runtime Failures

### Queue Full / Backpressure

**Symptom:**
```
Error: ERR_QUEUE_FULL: Execution queue at capacity (100/100)
  Queue depth: 100
  Oldest pending: 45.2s ago
```

**Cause:** Too many concurrent executions, or slow execution blocking queue.

**Diagnosis:**
```bash
# Check queue status
reach doctor --queue

# List running executions
reach ps
```

**Fix:**
1. Wait for pending executions to complete
2. Reduce concurrent job limits
3. Increase queue capacity: `REACH_QUEUE_SIZE=200`
4. Check for stuck executions: `reach doctor --stuck`

---

### Daemon Won't Start

**Symptom:**
```
Error: ERR_DAEMON_START: listen tcp 127.0.0.1:7734: bind: address already in use
```

**Cause:** Port already bound, or previous daemon not cleaned up.

**Diagnosis:**
```bash
# Check what's using the port
netstat -tlnp | grep 7734
# or on Windows
netstat -ano | findstr :7734

# Check for zombie processes
reach doctor --processes
```

**Fix:**
```bash
# Kill existing daemon
reach daemon kill

# Or use different port
REACH_DAEMON_PORT=7735 reach daemon start
```

---

### Memory Exhaustion

**Symptom:**
```
Error: ERR_OOM: Allocation failed - requested 2GB, available 512MB
  Matrix dimensions: 50000 x 50000
```

**Cause:** Requested matrix exceeds limits, or system memory exhausted.

**Diagnosis:**
```bash
# Check available memory
free -h
# or on Windows
systeminfo | findstr /B /C:"Total Physical Memory"

# Check process memory usage
reach doctor --memory
```

**Fix:**
1. Reduce matrix dimensions in request (max 1M cells)
2. Add memory limit: `REACH_MEMORY_LIMIT=4GB`
3. Increase system swap
4. Process in batches

---

## 4. Path/Security Failures

### Symlink Escape Attempt

**Symptom:**
```
Error: ERR_SYMLINK_ESCAPE: Path escapes workspace via symlink
  Requested: /tmp/otherdir/../reach/secret
  Resolved:  /home/user/reach/secret
```

**Cause:** Path traverses symlink outside workspace.

**Fix:** This is a security rejection. Review the path being accessed. If legitimate, copy file into workspace.

---

### Path Traversal Attempt

**Symptom:**
```
Error: ERR_PATH_TRAVERSAL: Invalid path characters in request
  Requested: ../../../etc/passwd
```

**Cause:** Path contains traversal sequences or invalid characters.

**Fix:** This is a security rejection. Use workspace-relative paths only.

---

## 5. Data Failures

### Replay Not Found

**Symptom:**
```
Error: ERR_REPLAY_NOT_FOUND: Transcript for fingerprint a1b2c3... not found
```

**Cause:** Run transcript was deleted or never saved.

**Fix:**
```bash
# Check available transcripts
reach ls --transcripts

# If using remote storage, verify connection
reach doctor --storage
```

---

### Registry Corruption

**Symptom:**
```
Error: ERR_REGISTRY_CORRUPT: Registry index checksum mismatch
```

**Cause:** Pack registry data corrupted.

**Fix:**
```bash
# Rebuild registry index
reach registry rebuild

# Or reset to defaults
reach registry reset
```

---

## 6. CI/Automation Failures

### CI Determinism Drift

**Symptom:** Local runs produce different fingerprints than CI.

**Diagnosis:**
```bash
# Compare environment
reach doctor --env-diff

# Check CI environment variables
echo $CI
echo $REACH_DETERMINISM_SEED
```

**Fix:**
1. Ensure `REACH_DETERMINISM_SEED` is set in CI
2. Pin Node/Rust versions in CI
3. Check for CI-specific environment differences
4. Use containerized CI with fixed image

---

## Diagnostic Commands Summary

| Command | Purpose |
|---------|---------|
| `reach doctor` | Full system diagnostics |
| `reach doctor --engine` | Engine-specific diagnostics |
| `reach doctor --protocol` | Protocol version info |
| `reach doctor --cas` | CAS integrity check |
| `reach doctor --queue` | Queue status |
| `reach doctor --bundle` | Generate debug bundle |
| `reach verify:determinism` | Determinism stress test |
| `reach ps` | List running processes |
| `reach logs` | View daemon logs |

---

## Getting Help

1. Generate debug bundle: `reach doctor --bundle`
2. Check logs: `reach logs --tail=100`
3. Search [GitHub Issues](https://github.com/reach/decision-engine/issues)
4. If security issue, email security@reach.dev (do not open public issue)
