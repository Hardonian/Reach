# Reach Operational Runbooks

> **Version:** 1.2
> **Last Updated:** 2026-02-27

Six operational procedures for common Reach issues.

---

## Runbook 1: Daemon Won't Start

### Symptoms

```
Error: ERR_DAEMON_START: Failed to start daemon
Error: ERR_ENGINE_NOT_FOUND: Requiem binary not found
```

### Diagnosis

```bash
# 1. Check if daemon is already running
reach doctor --processes

# 2. Check if engine binary exists
ls -la crates/requiem/target/release/requiem

# 3. Check version compatibility
reach doctor --engine-version
```

### Resolution

**If engine not found:**
```bash
pnpm install
pnpm -r --filter requiem build

# Verify
reach doctor --engine
```

**If daemon already running:**
```bash
# Kill existing daemon
reach daemon kill

# Or find and kill manually
ps aux | grep reach
kill <pid>
```

**If port in use:**
```bash
# Check what's using the port
netstat -tlnp | grep 7734
# or on Windows
netstat -ano | findstr :7734

# Either kill the process or use different port
REACH_DAEMON_PORT=7735 reach daemon start
```

**If permissions issue:**
```bash
# Check daemon directory permissions
ls -la ~/.reach/

# Fix if needed
chmod 755 ~/.reach/
```

### Verification

```bash
reach daemon start
reach doctor
# Verify all sections show [OK]
```

---

## Runbook 2: Pipe/Socket Already in Use

### Symptoms

```
Error: ERR_DAEMON_START: listen tcp 127.0.0.1:7734: bind: address already in use
Error: EADDRINUSE: Port 7734 is already in use
```

### Diagnosis

```bash
# Find process using the port
netstat -tlnp | grep 7734
lsof -i :7734
# or on Windows
netstat -ano | findstr :7734
```

### Resolution

**Option 1: Kill existing daemon**
```bash
reach daemon kill
```

**Option 2: Kill specific process**
```bash
kill -9 <PID>
```

**Option 3: Use different port**
```bash
REACH_DAEMON_PORT=7735 reach daemon start
```

**Option 4: Wait for socket cleanup**
```bash
# Sometimes port takes time to release
sleep 5
reach daemon start
```

### Prevention

- Always use `reach daemon kill` before restarting
- Check for stale processes after crashes
- Consider using different ports in development vs production

---

## Runbook 3: Queue Full / Backpressure

### Symptoms

```
Error: ERR_QUEUE_FULL: Execution queue at capacity (100/100)
Queue depth: 100
Oldest pending: 45.2s ago
```

### Diagnosis

```bash
# Check queue status
reach doctor --queue

# List running executions
reach ps

# Check for stuck executions
reach doctor --stuck
```

### Resolution

**Immediate (wait for drain):**
```bash
# Wait for queue to drain
# Monitor progress
reach doctor --queue
```

**If stuck executions:**
```bash
# Find stuck process
reach ps

# Cancel stuck execution
reach cancel <run-id>

# Or kill all running
reach daemon restart
```

**Increase capacity:**
```bash
# Temporarily increase queue size
REACH_QUEUE_SIZE=200 reach daemon start
```

**Reduce concurrency:**
```bash
# If client-side, reduce parallel requests
# Check for runaway clients
reach ps
```

### Verification

```bash
reach doctor --queue
# Should show available capacity
```

---

## Runbook 4: Determinism Drift Detected in CI

### Symptoms

```
ERROR: ERR_DETERMINISM_MISMATCH: Fingerprint mismatch
  CI fingerprint:    a1b2c3d4e5f6...
  Local fingerprint: 7f8e9d0c1b2a...
```

### Diagnosis

```bash
# Compare environments
reach doctor --env-diff

# Check for differences in:
# - Node version
# - Rust version
# - Environment variables
# - Platform (OS, architecture)
```

### Resolution

**Step 1: Pin versions in CI**

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      REACH_DETERMINISM_SEED: "your-seed-here"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'  # Pin version
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: '1.78'  # Pin Rust version
```

**Step 2: Check for non-deterministic code**

```bash
# Scan for non-deterministic sources
reach doctor --scan-determinism

# Look for:
# - Math.random()
# - Date.now()
# - UUID generation
# - Random seeds
```

**Step 3: Verify local determinism**

```bash
# Run local determinism check
reach verify:determinism --runs=10

# Should pass with identical fingerprints
```

**Step 4: Compare CI vs local**

```bash
# Run with verbose output
reach run <pack> --verbose

# Compare fingerprints exactly
echo "CI: $CI_FINGERPRINT"
echo "Local: $LOCAL_FINGERPRINT"
```

### Prevention

1. Always set `REACH_DETERMINISM_SEED` in CI
2. Pin Node and Rust versions
3. Use consistent environment
4. Test determinism in CI before merging

---

## Runbook 5: CAS Integrity Failure

### Symptoms

```
Error: ERR_CAS_INTEGRITY: Stored hash does not match computed hash
  CID: bafybeic7rx...
  Expected: deadbeef...
  Actual: feedface...
```

### Diagnosis

```bash
# Check CAS health
reach doctor --cas

# Verify specific CID
reach cas verify <cid>

# Check storage backend
reach doctor --storage
```

### Resolution

**If blob was evicted (LRU):**
```bash
# Try to re-fetch if source available
reach cas fetch <cid>

# Or re-run to regenerate
reach run <pack> --regenerate
```

**If blob corrupted:**
```bash
# Check if you have a backup
reach cas restore <cid> --from-backup

# Or re-run
reach run <pack> --regenerate
```

**If storage failing:**
```bash
# Check disk space
df -h

# Check storage permissions
ls -la ~/.reach/cas/

# Fix permissions if needed
chmod -R 755 ~/.reach/cas/
```

**If persistent failure:**
```bash
# Rebuild CAS index
reach cas rebuild

# Or reset CAS (will need to re-run everything)
reach cas reset
```

### Verification

```bash
# Verify CAS is healthy
reach doctor --cas

# Should show:
# Status: Healthy
# Integrity: All verified
```

---

## Runbook 6: Rollback Procedure

### When to Rollback

- Engine crash or hang
- Determinism failures
- Protocol incompatibility
- Security issues

### Quick Rollback (Environment Variable)

```bash
# Force Rust engine
FORCE_RUST=1 reach run my-pack

# Or set permanently
echo "export FORCE_RUST=1" >> ~/.bashrc
```

### Full Rollback (Reinstall Previous Version)

```bash
# 1. Check available versions
git tag -l 'v*'

# 2. Checkout previous version
git checkout v1.1.0

# 3. Clean and reinstall
pnpm clean
pnpm install

# 4. Rebuild engine
pnpm -r --filter requiem build

# 5. Verify
pnpm verify:smoke
```

### Protocol Rollback

```bash
# Pin to specific protocol version
REACH_PROTOCOL_VERSION=1.0 reach run my-pack

# Verify works
reach doctor --protocol
```

### Rollback Verification

After rollback, always verify:

```bash
# 1. Smoke test
pnpm verify:smoke

# 2. Determinism check
reach verify:determinism --runs=5

# 3. Replay verification
reach replay <fingerprint> --verify
```

### Emergency Rollback (Production)

If production is broken:

```bash
# 1. Stop current daemon
reach daemon kill

# 2. Start with forced engine
FORCE_RUST=1 reach daemon start

# 3. Verify works
reach doctor

# 4. Continue with forced engine until fix
```

### Rollback Checklist

- [ ] Document what broke
- [ ] Note version/environment
- [ ] Perform rollback
- [ ] Verify determinism
- [ ] Test critical paths
- [ ] Monitor for issues
- [ ] Plan fix for next release
