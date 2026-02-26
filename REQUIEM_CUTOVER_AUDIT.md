# Requiem Cutover Audit: Systems Audit + Determinism Stress Modeling

**Mode**: Parallel Systems Audit (Requiem Cutover)  
**Status**: Production-Bound Infrastructure  
**Auditor**: Gemini 3 Flash (Antigravity Mode)

---

## EXECUTIVE SUMMARY

1. **Architecture Drift**: Requiem is currently in "stub mode" in the TS adapter; the C++ binary and CMake build system are missing from the workspace, creating a phantom cutover risk.
2. **Precision Divergence**: The $10^{-10}$ rounding in `translate.ts` is a significant risk for C++ parity; bit-level drift in IEEE-754 floats will break fingerprints.
3. **Concurrency Bottleneck**: Subprocess execution via temp files creates a $O(N)$ disk I/O bottleneck and risks PID/File-handle exhaustion at 500+ concurrent calls.
4. **Semantic Mismatch**: The current fingerprint uses SHA-256 via Node `crypto`, while audit documents mandate BLAKE3, creating a "semantic trap" during CAS verification.
5. **Rollback Vulnerability**: Treat the Rust engine as "Warm" fallback. Environment bitrot on fallback paths is likely if skip-validation is allowed.
6. **I/O Atomicity**: CAS writes lack advisory locking; concurrent runs and GC sweeps could result in partial/corrupted capsules.
7. **Workspace Perimeter**: Symlink loops and path traversal in pack extraction remain unmitigated in the native C++ transition.
8. **Daemon State Leak**: Long-running "Serve Mode" processes are prone to memory fragmentation and RAII failures not present in the Rust/WASM model.
9. **Decision-Audit Integrity**: Determinism is lost if the `requestId` is not used as a cryptographic seed for all engine-internal RNG operations.
10. **Conclusion**: The cutover is viable but requires a move to a length-prefixed streaming protocol and fixed-point math to survive at scale.

---

## SECTION 1 — ENGINE CUTOVER FAILURE MODEL

### Top 12 Realistic Cutover Risks

| Rank | Risk | Trigger Condition | Detection Signal | Mitigation Guardrail |
| :--- | :---: | :--- | :--- | :--- |
| **1** | **Float Precision Drift** | Actions with relative utilities $< 10^{-10}$. | Fingerprint mismatch in dual-run. | Implement Fixed-Point math or IEEE-754 strict rounding in C++. |
| **2** | **Tie-Break Mismatch** | Multiple actions with identical max regret. | `recommended_action` differs in Dual-Run. | Mandate deterministic alpha-sort on ActionID for all ties. |
| **3** | **Process Limit Exhaustion** | 500+ concurrent `reach decide` invocations. | `EMFILE` or `EPIPE` errors in adapter logs. | Move to a persistent Engine Daemon (Serve Mode) with semaphores. |
| **4** | **I/O Race on Multi-Run** | Concurrent runs writing to same `.reach/engine-diffs`. | Overwritten or corrupted JSON diff reports. | Use UUID-v4 for diff filenames; implement atomic renames. |
| **5** | **Named Pipe Cleanup Failure** | Windows Daemon crash without closing pipe. | `EADDRINUSE` on serve-mode restart. | Use auto-cleaning pipe handles with process-heartbeat checks. |
| **6** | **CAS CID Collision** | SHA-256 (TS) vs BLAKE3 (Rust/C++) mismatch. | `ErrNotFound` on valid CID lookup. | Enforce Unified Multihash prefixing for all storage entries. |
| **7** | **Incomplete Rollback** | `REACH_ENGINE_FORCE_RUST` set but ignored. | Requiem execution found in logs despite flag. | Unified flag-check at the static `EngineAdapter` factory level. |
| **8** | **Large Artifact Hang** | JSON payload $> 500\text{MB}$ via temp files. | execution timeout ($> 30\text{s}$) during I/O phase. | Implement streaming JSON input; bypass temp file disk-sync. |
| **9** | **Encoding Corruption** | Unicode/UTF-16 paths used in Windows environment. | `ENOENT` for existing files during discovery. | Force UTF-8 normalization at the system boundary. |
| **10** | **Zombie Serving** | Parent process killed; C++ `serve` lingers. | Port/Socket exhaustion on host node. | Implement Parent Death Signal (PDS) or pidfile locking. |
| **11** | **Memory Ballooning** | Large outcome matrices processed on the heap. | SIGSEGV or exit code 137 (OOM). | Enforce RAII; set hard memory limits via rlimit/cgroups. |
| **12** | **Sampling Blindness** | Edge case bug not caught in 1% sample rate. | Mismatch reported only in 100% soak tests. | Implement Adaptive Sampling: 100% for first 1,000 runs of new IDs. |

---

## SECTION 2 — DETERMINISM FAILURE MATRIX

| Cause | Symptom | Early Detection | Preventative Control |
| :--- | :---: | :--- | :--- |
| **P-Thread Schedule** | Non-deterministic ordering in parallel graphs. | Trace CID mismatch on 100x repeats. | Seed the C++ task scheduler with `requestId`. |
| **JSON Key Order** | Fingerprint mismatch on identical output. | Canonicalization unit test failures. | Use `std::map` or sorted JSON emitters in Requiem. |
| **System Entropy** | Differing outcomes in "Adaptive" mode. | Dual-run trace diffs in "Quality" mode. | Inject a deterministic seed for all internal RNG. |
| **Float Rounding** | Ranking drift at the 11th decimal place. | Trace comparison in dual-run mode. | Force `decimal.h` or fixed-point utility math. |
| **IO Buffer Truncation** | Invalid JSON parse error on CLI exit. | Subprocess exit code != 0. | Implement a length-prefixed streaming protocol. |
| **Env Var Pollution** | Cache miss on identical code/input. | Trace metadata diffs. | Strip non-core env vars before engine spawn. |

---

## SECTION 3 — SECURITY & SANDBOX RED TEAM

### Red Team Checklist

- [ ] **Path Traversal**: Attempt to point `artifacts.uri` to `../../etc/passwd`.
- [ ] **Symlink Loop**: Create a symlink in a pack that points to the root of the CAS.
- [ ] **Signal Hijacking**: Send `SIGINT` to Reach and check for lingering `requiem serve` processes.
- [ ] **Binary Injection**: Set `REQUIEM_BIN` to a shell script that steals environment secrets.
- [ ] **CAS Poisoning**: Induce a secondary dual-run to write a malicious CID that the primary later consumes.
- [ ] **OOM DoS**: Submit a 1GB decision matrix to crash the host node's scheduler.
- [ ] **Plugin ABI Misuse**: Create a "malicious" plugin that modifies the result object after engine return but before hashing.

---

## SECTION 4 — 6-MONTH RISK FORECAST

| Risk | Prob | Impact | Early Signal | Guardrail |
| :--- | :---: | :---: | :--- | :--- |
| **CAS Scalability** | High | High | WAL growth $> 10\text{GB}$ in SQLite. | Transition to S3/GCS backend. |
| **Logic Drift** | Med | High | 0.5% Mismatch rate in Dual-Run. | "Zero-Tolerance" mismatch policy in CI. |
| **Observability Debt** | High | Low | Debug failures without Replay Capsules. | Persist full Replay Capsules on 500 errors. |
| **Windows Parity** | Med | High | Thread-lock timeout only on Azure nodes. | Mandatory Windows-native CI runners. |
| **Plugin Isolation** | Low | Med | Plugin crashing the core C++ process. | WASM-based plugin runner in Requiem. |

---

## SECTION 5 — HIGH-LEVERAGE GUARDRAILS

1. **Binary Version Lock**: `EngineAdapter` must check `requiem --version`. Fail fast if version != pinned semver.
2. **Strict Float Clamp**: Standardize on 10 decimal places across both Rust/C++ for all utility fingerprinting.
3. **Recursive Hash Check**: Enforce that any artifact read from CAS is re-hashed and compared against CID *before* it reaches the engine logic.
4. **Process Semaphore**: Cap maximum concurrent engine processes at `min(OS_CPU_COUNT, 32)` to prevent PID/Memory exhaustion.
5. **Audit Pulse**: In dual-run mode, if `fingerprint` mismatches, mark the run `UNSAFE` in the ledger even if `ActionID` matches.
6. **Deterministic Seed**: Derive a 64-bit seed from `requestId` and pass it to Requiem CLI for all probabilistic branch calls.
7. **Atomic Diff writes**: Use write-then-rename for all `.reach/engine-diffs` files to ensure report integrity.

---

> [!CAUTION]
> **Verdict**: The current "Stub Mode" implementation is a significant blind spot. Transition to a native C++ engine without a streaming I/O protocol and fixed-point math will increase system entropy and reduce long-term determinism.
