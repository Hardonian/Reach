# Reach Security Model

> **Version:** 1.2  
> **Status:** Production  
> **Last Updated:** 2026-02-27

Threat model, enforced protections, and unsupported scenarios for Reach with Requiem engine.

---

## 1. Threat Model

### Assets Protected

| Asset | Description | Sensitivity |
|-------|-------------|-------------|
| Run transcripts | Event logs of all executions | High |
| Fingerprints | BLAKE3 hashes of runs | High |
| Policy rules | Rego policy definitions | High |
| CAS blobs | Content-addressed artifacts | Medium |
| Configuration | System and pack configs | Medium |
| Execution output | Results from runs | Medium |

### Trust Boundaries

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Daemon    │────▶│   Engine    │
│  (untrusted)│     │  (trusted)  │     │  (trusted)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    CAS      │
                    │  (trusted)  │
                    └─────────────┘
```

### Attacker Profiles

| Profile | Capability | Goal |
|---------|-----------|------|
| Malicious pack author | Supply malicious policy | Execute arbitrary code |
| Workspace escape | Access files outside workspace | Read sensitive files |
| Determinism attacker | Inject non-determinism | Create false fingerprints |
| CAS attacker | Corrupt/evict blobs | Undermine evidence chain |
| Protocol attacker | Malformed frames | Crash or exploit engine |

---

## 2. Enforced Protections

The following security measures are **guaranteed** by the Requiem engine:

### 2.1 Workspace Isolation

- **Symlink escape prevention**: Paths traversing symlinks outside workspace are rejected
- **Path traversal rejection**: Sequences like `../` are blocked
- **Path normalization**: All paths canonicalized before access
- **TOCTOU protection**: Check-then-use with re-verification

### 2.2 Environment Sanitization

Environment variables are filtered before passing to child processes:

**Blocked patterns:**
```
*_TOKEN, *_SECRET, *_KEY, AUTH*, COOKIE*, SESSION*
REACH_ENCRYPTION_KEY, AWS_*, GCP_*, AZURE_*
```

**Verification:**
```bash
reach doctor --env-sanitization
```

### 2.3 Binary Integrity

- Engine binary must match expected hash
- Binary verification on startup
- Permission checks on executable
- Version lock enforcement

### 2.4 Memory Safety

- Request size limits: 10MB default
- Matrix dimension limits: 1M cells max
- Concurrency semaphore
- Memory limits via `setrlimit` (POSIX) / Job Objects (Windows)

### 2.5 CAS Integrity

- BLAKE3(content) as content address
- Double verification: stored hash + decompressed content
- Symlink rejection in CAS paths
- Explicit `verify_llm_freeze_integrity(cid)` API

### 2.6 Plugin/LLM Isolation

- Hash-after-freeze: results hashed immediately
- Plugins receive immutable copies
- Policy disclosure for modifications
- No direct memory access to parent

---

## 3. Unsupported / Out of Scope

The following are **NOT guaranteed** or are **out of scope**:

### 3.1 Capability Truth (Sandbox Limitations)

| Concern | Status |
|---------|--------|
| Malicious policy rules | Not sandboxed from system calls |
| Pack network access | Can make outbound connections |
| Pack file access | Limited only by workspace boundary |
| Pack CPU usage | Capped by OS, not internal limits |
| Pack memory usage | Limited but not fully isolated |
| Malicious plugins | Assume trusted plugins only |

**Note:** Reach does NOT provide strong sandbox isolation. Packs with file/network capabilities can access those resources within workspace limits.

### 3.2 External Systems

| Concern | Status |
|---------|--------|
| Webhook provider security | Out of scope |
| OAuth provider compromise | Out of scope |
| External API availability | Out of scope |
| Network MitM attacks | TLS only, no cert pinning |
| DNS poisoning | Out of scope |

### 3.3 Runtime Environment

| Concern | Status |
|---------|--------|
| Kernel exploits | Out of scope |
| Container escape | Out of scope (if running in containers) |
| Side-channel attacks | Out of scope |
| Timing attacks on deterministic code | Mitigated but not guaranteed |

### 3.4 Data at Rest

| Concern | Status |
|---------|--------|
| CAS encryption | Not enabled by default |
| Transcript encryption | Not encrypted at rest |
| Backup integrity | User responsibility |

---

## 4. Security Configuration

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `REACH_SECURITY_LEVEL` | Set to `strict` for hardened mode | `standard` |
| `REACH_ALLOW_NETWORK` | `0` to disable network | `1` |
| `REACH_MAX_MEMORY` | Max memory per run | `4GB` |
| `REACH_SANITIZE_ENV` | `1` to force env sanitization | `1` |

### Security Check

```bash
# Run security audit
reach doctor --security

# Verify all protections
reach doctor --security-full
```

---

## 5. Reporting Security Issues

**Do NOT open public GitHub issues for security vulnerabilities.**

Email: **security@reach.dev**

Include:
- Affected component(s)
- Reproduction steps
- Impact assessment
- Any proof-of-concept

---

## 6. Security Logged Events

The following are logged for audit:

| Event | Logged |
|-------|--------|
| Policy denied | Yes |
| Symlink escape attempt | Yes |
| Path traversal attempt | Yes |
| Binary integrity failure | Yes |
| CAS integrity failure | Yes |
| Environment leak attempt | Yes |
| Execution denied | Yes |

---

## 7. Comparison: Enforced vs Unsupported

| Feature | Enforced | Unsupported |
|---------|----------|-------------|
| Determinism | ✅ BLAKE3 + fixed-point | - |
| Fingerprint integrity | ✅ Cryptographically linked | - |
| Replay verification | ✅ Full replay | - |
| Workspace escape | ✅ Blocked | - |
| Path traversal | ✅ Blocked | - |
| Symlink escape | ✅ Blocked | - |
| CAS integrity | ✅ Double verification | - |
| Env sanitization | ✅ Pattern blocking | - |
| Binary integrity | ✅ Hash verification | - |
| Memory limits | ✅ OS-level | - |
| Strong sandbox | - | ❌ Not provided |
| Network isolation | - | ❌ Not provided |
| Malicious policy | - | ❌ Not sandboxed |
| Data encryption at rest | - | ❌ Not enabled |
| Container isolation | - | ❌ Out of scope |
| Kernel security | - | ❌ Out of scope |
