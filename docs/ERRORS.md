# Reach Error Reference

> **Version:** 1.2  
> **Status:** Production  
> **Last Updated:** 2026-02-27

Error codes, meanings, and operator actions for Reach with Requiem engine.

---

## Engine Errors

### ERR_ENGINE_NOT_FOUND

**Meaning:** Requiem binary not found or not built.

**Operator Action:**
```bash
# Rebuild engine
pnpm -r --filter requiem build

# Verify binary exists
ls -la crates/requiem/target/release/requiem
```

---

### ERR_ENGINE_CRASHED

**Meaning:** Requiem engine exited unexpectedly.

**Operator Action:**
1. Check logs: `reach logs --engine`
2. Run with debug: `reach run <pack> --debug`
3. Report issue with debug bundle

---

### ERR_ENGINE_TIMEOUT

**Meaning:** Engine did not respond within expected time.

**Operator Action:**
1. Check system load: `reach doctor --system`
2. Increase timeout: `REACH_ENGINE_TIMEOUT=300s reach run <pack>`
3. Check for stuck processes: `reach ps`

---

## Determinism Errors

### ERR_DETERMINISM_MISMATCH

**Meaning:** Replay fingerprint does not match original. The same inputs produced different outputs.

**Operator Action:**
1. Run deterministic check: `reach verify:determinism --runs=10`
2. Review execution for non-deterministic sources:
   - `Math.random()` or `rand.*`
   - `Date.now()` or timestamp usage
   - UUID generation in policy
3. Check for floating-point operations (should use fixed-point)
4. Verify environment variables are identical

**If false positive:** Input may contain dynamic data (timestamps, session IDs). Use deterministic seeds.

---

### ERR_DETERMINISM_VERIFY_FAILED

**Meaning:** Could not verify deterministic behavior.

**Operator Action:**
```bash
# Run extended verification
reach verify:determinism --runs=50 --verbose

# Check engine version
reach doctor --engine-version
```

---

## CAS Errors

### ERR_CAS_INTEGRITY

**Meaning:** CAS blob hash mismatch. Data corrupted or modified.

**Operator Action:**
```bash
# Verify specific CID
reach cas verify <cid>

# Check CAS health
reach doctor --cas

# If blob evicted, attempt re-fetch
reach cas fetch <cid>

# If persistent corruption, re-run with --regenerate
reach run <pack> --regenerate
```

---

### ERR_CAS_NOT_FOUND

**Meaning:** Requested content not in CAS.

**Operator Action:**
1. Check if content was evicted
2. Re-fetch if source available
3. Re-run to regenerate if needed

---

### ERR_CAS_EVICTED

**Meaning:** CAS blob was evicted to free space.

**Operator Action:**
```bash
# Check CAS size limits
reach doctor --cas-limits

# Increase CAS size
REACH_CAS_MAX_SIZE=50GB

# Or restore from backup if available
reach cas restore <cid>
```

---

## Protocol Errors

### ERR_PROTOCOL_VERSION_MISMATCH

**Meaning:** Client and server protocol versions incompatible.

**Operator Action:**
```bash
# Check versions
reach doctor --protocol

# Pin compatible version
REACH_PROTOCOL_VERSION=1.0 reach run <pack>

# Or upgrade engine
pnpm -r --filter requiem build
```

---

### ERR_PROTOCOL_FRAME_INVALID

**Meaning:** Malformed protocol frame received.

**Operator Action:**
1. Check network stability
2. Update to latest version (may be bug fix)
3. Run with protocol debug: `reach run <pack> --protocol-debug`

---

### ERR_PROTOCOL_HANDSHAKE_FAILED

**Meaning:** Initial protocol handshake failed.

**Operator Action:**
```bash
# Verify engine and CLI versions match
reach doctor --versions

# Full reinstall
pnpm clean && pnpm install
```

---

## Queue/Execution Errors

### ERR_QUEUE_FULL

**Meaning:** Execution queue at capacity. Too many concurrent requests.

**Operator Action:**
1. Wait for pending executions to complete
2. Reduce client-side concurrency
3. Increase queue size: `REACH_QUEUE_SIZE=200`
4. Check for stuck executions: `reach doctor --stuck`

---

### ERR_EXECUTION_TIMEOUT

**Meaning:** Execution exceeded time limit.

**Operator Action:**
```bash
# Increase timeout
REACH_EXECUTION_TIMEOUT=600s reach run <pack>

# Check for infinite loops in policy
reach run <pack> --debug

# Optimize policy execution
```

---

### ERR_EXECUTION_CANCELLED

**Meaning:** Execution was cancelled by user or system.

**Operator Action:**
1. Check if user initiated cancellation
2. Check for system shutdown during execution
3. Re-run if needed

---

## Security Errors

### ERR_SYMLINK_ESCAPE

**Meaning:** Path escapes workspace via symlink. Security rejection.

**Operator Action:**
This is a security rejection. Review the path being accessed:
- Copy file into workspace instead of using symlink
- Use workspace-relative paths only

---

### ERR_PATH_TRAVERSAL

**Meaning:** Path contains traversal sequences. Security rejection.

**Operator Action:**
This is a security rejection. Use workspace-relative paths only.

---

### ERR_ENV_LEAK

**Meaning:** Sensitive environment variable detected in child process.

**Operator Action:**
This is a security rejection. Review environment sanitization.

---

### ERR_BINARY_TAMPERING

**Meaning:** Engine binary modified or replaced.

**Operator Action:**
```bash
# Reinstall
pnpm clean && pnpm install

# Verify binary integrity
reach doctor --binary-verify
```

---

## Storage Errors

### ERR_STORAGE_NOT_FOUND

**Meaning:** Requested storage path does not exist.

**Operator Action:**
1. Check storage configuration
2. Create directory if needed
3. Verify permissions

---

### ERR_STORAGE_PERMISSION

**Meaning:** Insufficient permissions to access storage.

**Operator Action:**
```bash
# Check permissions
ls -la <storage-path>

# Fix ownership
chown -R $(whoami) <storage-path>
```

---

### ERR_REGISTRY_CORRUPT

**Meaning:** Pack registry index corrupted.

**Operator Action:**
```bash
# Rebuild registry
reach registry rebuild

# Or reset to defaults
reach registry reset
```

---

## Replay Errors

### ERR_REPLAY_NOT_FOUND

**Meaning:** Run transcript not found.

**Operator Action:**
```bash
# List available transcripts
reach ls --transcripts

# Check storage
reach doctor --storage
```

---

### ERR_REPLAY_MISMATCH

**Meaning:** Replay produced different result than original.

**Operator Action:**
Same as ERR_DETERMINISM_MISMATCH - see that entry.

---

## Configuration Errors

### ERR_CONFIG_INVALID

**Meaning:** Configuration value invalid.

**Operator Action:**
```bash
# Validate config
reach doctor --config-validate

# Check specific config file
reach doctor --config-show
```

---

### ERR_CONFIG_MISSING

**Meaning:** Required configuration missing.

**Operator Action:**
1. Check required env vars are set
2. Create config file: `reach init`
3. See CONFIG.md for required fields

---

## Error Code Format

Error codes follow: `ERR_SUBSYSTEM_REASON`

| Prefix | Subsystem |
|--------|-----------|
| `ERR_ENGINE_*` | Execution engine |
| `ERR_DETERMINISM_*` | Determinism verification |
| `ERR_CAS_*` | Content-addressable storage |
| `ERR_PROTOCOL_*` | Binary protocol |
| `ERR_QUEUE_*` | Execution queue |
| `ERR_EXECUTION_*` | Run execution |
| `ERR_SECURITY_*` | Security checks |
| `ERR_STORAGE_*` | Storage backend |
| `ERR_REPLAY_*` | Replay verification |
| `ERR_CONFIG_*` | Configuration |
