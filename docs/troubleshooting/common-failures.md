# Reach Troubleshooting Guide

A comprehensive guide for diagnosing and resolving common Reach issues. Use this as your first stop when something isn't working.

---

## Quick Diagnostic: `reach doctor`

Always run this first:

```bash
./reach doctor          # Human-readable output
./reach doctor --json   # Machine-readable output
./reach doctor --fix    # Auto-fix known issues
```

### Interpreting Doctor Output

| Section                     | Purpose                               | When to Worry                          |
| --------------------------- | ------------------------------------- | -------------------------------------- |
| **Toolchain Checks**        | Verifies git, node, go, python, cargo | FAIL blocks development                |
| **Docker Check**            | Validates container runtime           | WARN ok; FAIL if using containers      |
| **Configuration Check**     | .env file presence                    | WARN triggers --fix to create defaults |
| **Registry/Source Checks**  | Internal source code validation       | FAIL indicates repo corruption         |
| **Architecture Boundaries** | Import path validation                | FAIL blocks builds                     |

---

## Common Failures

### 1. Installation Issues

#### Symptom: `reach: command not found` or `reachctl: command not found`

**Likely Cause:** CLI not in PATH or not built

**Diagnose:**

```bash
# Check if binary exists
ls -la ./reachctl* 2>/dev/null || echo "Binary not found"
which reachctl 2>/dev/null || echo "Not in PATH"

# Check Windows executable
ls reachctl.exe 2>/dev/null && echo "Windows build present"
```

**Fix:**

```bash
# Option 1: Use local binary directly
./reachctl doctor

# Option 2: Add to PATH (Unix)
export PATH="$PATH:$(pwd)"
echo 'export PATH="$PATH:'"$(pwd)"'"' >> ~/.bashrc

# Option 3: Add to PATH (Windows PowerShell)
$env:PATH += ";$(Get-Location)"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```

---

#### Symptom: `cannot execute binary file: Exec format error`

**Likely Cause:** Binary architecture mismatch (e.g., ARM binary on x86)

**Diagnose:**

```bash
# Check system architecture
uname -m  # Linux/macOS
uname -a  # Full system info

# Check binary architecture (macOS)
file reachctl

# Check binary architecture (Linux)
file reachctl
readelf -h reachctl | grep Machine
```

**Fix:**

```bash
# Rebuild from source for your architecture
go build -o reachctl ./services/runner/cmd/reachctl

# Or download correct release
# See: https://github.com/reach/reach/releases
```

---

### 2. Build Cache Issues

#### Symptom: Build fails with "module not found" or stale dependency errors

**Likely Cause:** Corrupted node_modules or Go build cache

**Diagnose:**

```bash
# Check node_modules age
ls -la node_modules/.package-lock.json 2>/dev/null || echo "No lockfile"
du -sh node_modules 2>/dev/null || echo "node_modules missing"

# Check for circular dependencies
npm ls 2>&1 | head -20

# Verify Go module integrity
cd services/runner && go mod verify && cd ../..
```

**Fix:**

```bash
# Nuclear option: Clean everything
rm -rf node_modules
rm -rf services/runner/node_modules
rm -rf packages/*/node_modules
rm -rf ~/.npm/_cacache

# Clean Go cache
go clean -cache

# Reinstall
pnpm install

# Verify
./reach doctor
```

---

#### Symptom: `Error: Cannot find module './dist/...'` after build

**Likely Cause:** Build artifacts missing or partial build

**Diagnose:**

```bash
# Check for dist directories
find . -name "dist" -type d -not -path "*/node_modules/*" | head -10

# Check TypeScript compilation errors
pnpm run build 2>&1 | grep -i error | head -10
```

**Fix:**

```bash
# Full rebuild
pnpm run clean 2>/dev/null || rm -rf dist
pnpm install
pnpm run build

# If TypeScript errors persist
cat tsconfig.json | grep -A5 "compilerOptions"
```

---

### 3. Database Path Permission Issues

#### Symptom: `Permission denied` when writing to data directory

**Likely Cause:** REACH_DATA_DIR has incorrect permissions

**Diagnose:**

```bash
# Check current data directory
echo "REACH_DATA_DIR: ${REACH_DATA_DIR:-./data}"

# Verify permissions
ls -la data/ 2>/dev/null || echo "data/ not found"
ls -la ~/.reach/ 2>/dev/null || echo "~/.reach/ not found"

# Check disk space
df -h . 2>/dev/null || wmic logicaldisk get size,freespace,caption

# Test write access
touch "${REACH_DATA_DIR:-./data}/.write_test" 2>&1 && rm "${REACH_DATA_DIR:-./data}/.write_test" && echo "Write OK"
```

**Fix:**

```bash
# Fix permissions (Unix)
mkdir -p ~/.reach/data
chmod 755 ~/.reach/data
chown $(whoami):$(whoami) ~/.reach/data

# Fix permissions (Windows PowerShell)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.reach\data"
$path = "$env:USERPROFILE\.reach\data"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = Get-Acl $path
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl $path $acl

# Alternative: Use different data directory
export REACH_DATA_DIR=/tmp/reach-data
mkdir -p $REACH_DATA_DIR
```

---

#### Symptom: `STORAGE_WRITE_FAILED` or `STORAGE_READ_FAILED` errors

**Likely Cause:** Database corruption or locked by another process

**Diagnose:**

```bash
# Check if database is locked (SQLite)
fuser data/reach.db 2>/dev/null || echo "Not locked by process"

# Check database integrity
sqlite3 data/reach.db "PRAGMA integrity_check;" 2>/dev/null || echo "SQLite not available or DB corrupt"

# Check for multiple instances
ps aux | grep -E "reach|node" | grep -v grep | wc -l
```

**Fix:**

```bash
# Stop all Reach processes
pkill -f reachctl
pkill -f "reach serve"

# Backup corrupted DB
cp data/reach.db data/reach.db.backup.$(date +%s)

# Reset to fresh state (WARNING: deletes data)
rm data/reach.db
./reach serve --init  # Re-initialize

# Or use temporary storage
export REACH_DATA_DIR=/tmp/reach-fresh-$(date +%s)
mkdir -p $REACH_DATA_DIR
```

---

### 4. Missing Environment Variables

#### Symptom: `CONFIG_MISSING` or `Invalid configuration` errors

**Likely Cause:** Required environment variables not set

**Diagnose:**

```bash
# Check which env vars are set
echo "REACH_DATA_DIR: ${REACH_DATA_DIR:-<not set>}"
echo "REACH_BASE_URL: ${REACH_BASE_URL:-<not set>}"
echo "REACH_LOG_LEVEL: ${REACH_LOG_LEVEL:-<not set>}"

# Check .env file presence
ls -la .env 2>/dev/null || echo "No .env file"
cat .env 2>/dev/null | grep -v "^#" | grep -v "^$" | head -10

# Validate with doctor
./reach doctor 2>&1 | grep -i "config"
```

**Fix:**

```bash
# Auto-create default .env
./reach doctor --fix

# Or manually create minimal .env
cat > .env << 'EOF'
# Reach Configuration
NEXT_PUBLIC_BRAND_NAME=ReadyLayer
REACH_LOG_LEVEL=info
EOF

# Source the file
export $(cat .env | grep -v "^#" | xargs)
```

---

#### Symptom: `POLICY_INVALID_SIGNATURE` in production mode

**Likely Cause:** Missing signing keys for production

**Diagnose:**

```bash
# Check for signing keys
ls -la keys/ 2>/dev/null || echo "No keys directory"
ls -la ~/.reach/keys/ 2>/dev/null || echo "No user keys"

# Check policy pack signatures
cat policy-packs/strict-safe-mode.json | grep -i signature
```

**Fix:**

```bash
# Generate development keys (DO NOT USE IN PRODUCTION)
mkdir -p keys
openssl genrsa -out keys/dev.key 2048 2>/dev/null || echo "OpenSSL not available"

# For production, see: docs/internal/PRODUCTION_DEPLOYMENT.md
```

---

### 5. Port Conflicts

#### Symptom: `Port already in use` or `EADDRINUSE`

**Likely Cause:** Another process using Reach's default port (8787)

**Diagnose:**

```bash
# Find process using port 8787
lsof -i :8787 2>/dev/null || netstat -ano | grep 8787 2>/dev/null || echo "Port check tool not available"

# Check Reach processes
ps aux | grep -E "reach|8787" | grep -v grep

# Test if something responds
curl -s http://localhost:8787/health 2>/dev/null && echo "Port 8787 is active"
```

**Fix:**

```bash
# Option 1: Use different port
./reach serve --port 8788
export REACH_BASE_URL=http://localhost:8788

# Option 2: Kill existing process
lsof -ti:8787 | xargs kill -9 2>/dev/null || netstat -ano | grep 8787 | awk '{print $5}' | xargs taskkill /F /PID

# Option 3: Find and use any available port
PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()" 2>/dev/null || echo 8788)
./reach serve --port $PORT
```

---

### 6. Corrupted Bundle/Pack

#### Symptom: `REGISTRY_INVALID_MANIFEST` or `Pack verification failed`

**Likely Cause:** Corrupted or manually edited pack.json

**Diagnose:**

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('pack.json'))" && echo "JSON valid"

# Check required fields
cat pack.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('id:', d.get('id')); print('deterministic:', d.get('deterministic'))"

# Verify against schema
./reach verify-pack pack.json 2>&1 | head -20
```

**Fix:**

```bash
# Re-download or regenerate pack
# Option 1: Use example packs
cp examples/01-quickstart-local/pack.json ./pack.json

# Option 2: Create minimal valid pack
cat > pack.json << 'EOF'
{
  "id": "quickstart-local",
  "version": "1.0.0",
  "name": "Quickstart Local Demo",
  "description": "Minimal deterministic execution",
  "deterministic": true,
  "entry": {
    "type": "analysis",
    "action": "infrastructure_review"
  },
  "policies": ["policy-packs/strict-safe-mode.json"]
}
EOF
```

---

#### Symptom: `Signature verification failed` for packs

**Likely Cause:** Pack was modified after signing or wrong key

**Diagnose:**

```bash
# Check signature field
cat pack.json | grep -A5 signature

# Verify with explicit key
./reach verify-pack --key keys/dev.key pack.json

# Check manifest hash
cat pack.json | python3 -c "import json,sys,hashlib; d=json.load(sys.stdin); d.pop('signature',None); h=hashlib.sha256(json.dumps(d,sort_keys=True).encode()).hexdigest(); print('Computed hash:', h[:16]+'...')"
```

**Fix:**

```bash
# Re-sign the pack (if you have the key)
./reach sign-pack --key keys/dev.key pack.json

# Or use unsigned packs in dev mode
export REACH_ALLOW_UNSIGNED=true  # Only for development!
```

---

### 7. Verify/Determinism Failures

#### Symptom: `REPLAY_MISMATCH` or fingerprints differ between runs

**Likely Cause:** Non-deterministic input or environment differences

**Diagnose:**

```bash
# Run 3 times and compare fingerprints
for i in 1 2 3; do
  ./reach run pack.json --input seed.json 2>&1 | grep -i fingerprint | tee /tmp/run_$i.log
done
diff /tmp/run_1.log /tmp/run_2.log && echo "Runs 1-2 match" || echo "MISMATCH 1-2"
diff /tmp/run_2.log /tmp/run_3.log && echo "Runs 2-3 match" || echo "MISMATCH 2-3"

# Check for non-deterministic inputs
cat seed.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Has timestamp:', 'timestamp' in str(d)); print('Has random:', 'random' in str(d).lower())"
```

**Fix:**

```bash
# Remove timestamps from input
jq 'del(.timestamp, .created_at, .request_time)' seed.json > seed_clean.json

# Ensure consistent environment
unset RANDOM_SEED_CUSTOM  # Let Reach control seeding
export REACH_DETERMINISTIC_MODE=strict

# Verify with built-in checker
./reach verify-determinism --n 5 --pack pack.json --input seed.json
```

---

#### Symptom: `./reach verify-determinism` fails after code changes

**Likely Cause:** Changes introduced entropy (time.Now(), random, map iteration)

**Diagnose:**

```bash
# Check for common entropy sources
grep -r "time.Now()" src/ crates/ services/ --include="*.go" --include="*.rs" --include="*.ts" | grep -v test | head -10
grep -r "math/rand" src/ crates/ services/ --include="*.go" --include="*.rs" | grep -v test | head -10

# Check for unordered map iteration (Go)
grep -rn "for.*range.*map" services/ --include="*.go" | grep -v test | head -10

# Run with race detector
go test -race ./services/runner/... 2>&1 | grep -i "race\|WARNING"
```

**Fix:**

```bash
# Review docs/internal/DETERMINISM_SPEC.md

# Replace time.Now() with deterministic clock
# Replace math/rand with crypto/rand or seeded source
# Sort map keys before iteration

# See specific fixes in:
# - docs/internal/DETERMINISM_DEBUGGING.md
# - services/runner/internal/determinism/
```

---

### 8. Replay Engine Issues

#### Symptom: `REPLAY_NOT_FOUND` or cannot replay previous run

**Likely Cause:** Replay data expired or was compacted

**Diagnose:**

```bash
# Check if replay data exists
ls -la data/replays/ 2>/dev/null || echo "No replays directory"
find data/ -name "*replay*" -o -name "*run_*" 2>/dev/null | head -10

# Check retention settings
cat config.yaml 2>/dev/null | grep -i retention
grep -r "RETENTION" .env 2>/dev/null

# Check run ID format
./reach list-runs --limit 5
```

**Fix:**

```bash
# Run with longer retention
export REACH_RETENTION_DAYS=30
./reach run pack.json --input seed.json

# Disable compaction for testing
export REACH_COMPACTION_ENABLED=false
```

---

#### Symptom: `REPLAY_CORRUPT` - replay data exists but won't load

**Likely Cause:** Storage corruption or version mismatch

**Diagnose:**

```bash
# Check file integrity
file data/replays/run_*.json 2>/dev/null | head -5

# Validate JSON
find data/replays -name "*.json" -exec python3 -c "import json; json.load(open('{}'))" \; 2>&1 | head -5

# Check version compatibility
cat data/replays/run_*.json 2>/dev/null | head -1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('Schema version:', d.get('schema_version', 'unknown'))"
```

**Fix:**

```bash
# Clear corrupted replays (WARNING: loses history)
rm -rf data/replays/
mkdir -p data/replays

# Re-run to generate fresh replay data
./reach run pack.json --input seed.json
```

---

### 9. Federation/Mesh Issues

#### Symptom: `FEDERATION_NODE_UNREACHABLE` or `FEDERATION_HANDSHAKE_FAILED`

**Likely Cause:** Network connectivity or certificate issues between nodes

**Diagnose:**

```bash
# Check target node health
curl -s http://<node-ip>:8787/health 2>/dev/null || echo "Node unreachable"

# Check federation config
cat config.yaml | grep -A10 federation
grep FEDERATION .env

# Verify certificates
openssl s_client -connect <node-ip>:8787 2>&1 | head -10
```

**Fix:**

```bash
# Option 1: Skip certificate validation (dev only)
export FEDERATION_INSECURE_SKIP_VERIFY=true

# Option 2: Add node to allowlist
./reach federation trust-node <node-id>

# Option 3: Check firewall rules
# Ensure port 8787 is open between nodes
```

---

#### Symptom: `FEDERATION_REPLAY_MISMATCH` during verification

**Likely Cause:** Different Reach versions or different policy packs

**Diagnose:**

```bash
# Compare versions
./reach version
curl -s http://<remote-node>:8787/version

# Compare policy hashes
./reach policy-hash
curl -s http://<remote-node>:8787/policy-hash
```

**Fix:**

```bash
# Sync to same version
git pull origin main
./reach update

# Sync policy packs
./reach federation sync-policies
```

---

### 10. Policy Engine Issues

#### Symptom: `POLICY_DENIED` but policy looks correct

**Likely Cause:** Wrong policy being applied or precedence issue

**Diagnose:**

```bash
# Check which policies are active
./reach policy-list
cat pack.json | grep -A5 policies

# Check policy precedence
grep -r "precedence\|priority" policy-packs/ --include="*.json" | head -5

# Verbose policy evaluation
./reach run pack.json --input seed.json --verbose-policy
```

**Fix:**

```bash
# Check policy syntax
./reach validate-policy policy-packs/strict-safe-mode.json

# Test with permissive policy
./reach run pack.json --input seed.json --policy-override policy-packs/permissive.json
```

---

#### Symptom: `POLICY_UNDECLARED_TOOL` - tool used but not in policy

**Likely Cause:** Pack uses tools not declared in policy

**Diagnose:**

```bash
# List tools in pack
./reach pack-inspect pack.json | grep tools

# List allowed tools in policy
cat policy-packs/strict-safe-mode.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('Allowed tools:', d.get('tools', []))"
```

**Fix:**

```bash
# Add tool to policy
cat > /tmp/tool_patch.json << 'EOF'
{
  "tools": ["file_read", "file_write", "shell_exec"]
}
EOF
./reach policy-merge policy-packs/strict-safe-mode.json /tmp/tool_patch.json
```

---

### 11. Execution Timeout Issues

#### Symptom: `EXECUTION_TIMEOUT` or `SANDBOX_TIMEOUT`

**Likely Cause:** Infinite loop or resource-intensive operation

**Diagnose:**

```bash
# Check resource usage
top -p $(pgrep -f reach | tr '\n' ',') 2>/dev/null || tasklist | findstr reach

# Check for tight loops in pack logic
grep -r "while.*true\|for.*:" pack/ src/ 2>/dev/null | head -5

# Monitor with timeout
./reach run pack.json --timeout 30s --verbose
```

**Fix:**

```bash
# Increase timeout
./reach run pack.json --timeout 5m

# Or in config
cat >> config.yaml << 'EOF'
execution:
  timeout: 300s
  max_iterations: 1000
EOF
```

---

### 12. Docker Issues

#### Symptom: Docker-related checks fail in `reach doctor`

**Likely Cause:** Docker not installed or daemon not running

**Diagnose:**

```bash
# Check Docker
docker --version
docker info 2>&1 | head -5

# Check Docker Desktop (macOS/Windows)
# - macOS: ls -la /var/run/docker.sock
# - Windows: Get-Service docker
```

**Fix:**

```bash
# Start Docker Desktop
# Or on Linux:
sudo systemctl start docker

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and back in
```

---

#### Symptom: Container builds fail with "no space left on device"

**Likely Cause:** Docker image cache full

**Diagnose:**

```bash
docker system df
docker images | wc -l
```

**Fix:**

```bash
# Clean up
docker system prune -f
docker volume prune -f

# Or more aggressive
docker rmi $(docker images -q)
```

---

### 13. Demo Report Failures

#### Symptom: `./reach report demo` fails or produces incomplete output

**Likely Cause:** Missing examples or environment issues

**Diagnose:**

```bash
# Check examples exist
ls examples/01-quickstart-local/run.js
ls examples/README.md

# Run individual examples
node examples/01-quickstart-local/run.js 2>&1 | tail -10

# Check demo-report directory
ls demo-report/
```

**Fix:**

```bash
# Restore examples from git
git checkout examples/

# Re-run specific example
cd examples/01-quickstart-local && node run.js

# Generate fresh demo report
rm -rf demo-report/
./reach report demo
```

---

### 14. Git Repository Issues

#### Symptom: `reach doctor` fails with git-related errors

**Likely Cause:** Not in a git repository or corrupted git state

**Diagnose:**

```bash
# Check git status
git status 2>&1 | head -5
git rev-parse --show-toplevel 2>&1

# Check for uncommitted changes
git diff --stat | head -5
```

**Fix:**

```bash
# Initialize if needed
git init

# Fix corrupted state
git fsck

# Or run doctor outside repo with explicit root
./reach doctor --root .
```

---

### 15. Network/Proxy Issues

#### Symptom: Registry downloads fail or timeout

**Likely Cause:** Corporate proxy or firewall blocking requests

**Diagnose:**

```bash
# Test connectivity
curl -I https://registry.reach.dev 2>/dev/null || echo "Registry unreachable"

# Check proxy settings
echo "HTTP_PROXY: ${HTTP_PROXY:-<not set>}"
echo "HTTPS_PROXY: ${HTTPS_PROXY:-<not set>}"
echo "NO_PROXY: ${NO_PROXY:-<not set>}"
```

**Fix:**

```bash
# Configure proxy
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1

# Or disable external registry
export REACH_REGISTRY_OFFLINE=true
```

---

## Emergency Recovery

If nothing works, try this sequence:

```bash
# 1. Stop everything
pkill -f reach
pkill -f node

# 2. Reset to clean state
git status  # Note any work to save
git stash   # Save work
git clean -fdx  # WARNING: Deletes all untracked files

# 3. Fresh install
git checkout main
git pull origin main
pnpm install
./reach doctor --fix

# 4. Test
./reach doctor
node examples/01-quickstart-local/run.js
```

---

## Getting More Help

If issues persist:

1. **Run diagnostics:** `./reach doctor --json > diagnostics.json`
2. **Collect logs:** `cat logs/errors.txt | tail -100`
3. **Check version:** `./reach version`
4. **Submit issue:** Include diagnostics.json and reproduction steps

See also:

- [Error Codes Reference](../ERROR_CODES.md)
- [Determinism Debugging](../DETERMINISM_DEBUGGING.md)
- [Bug Reporting Guide](../contrib/bug-reporting.md)
