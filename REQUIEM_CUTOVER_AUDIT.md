# Reach Engine Cutover Audit: Rust → Requiem (C++)

**Status**: Production-Bound Infrastructure Audit  
**Version**: 1.0.0-audit  
**Project**: Zeo / Reach CLI  

---

## 1. Executive Summary

- **High Precision Drift**: The primary risk is bit-level divergence in floating-point operations between Rust (IEEE 754 via LLVM) and Requiem (C++).
- **Dual-Run Resource Exhaustion**: Running two engines concurrently for every request doubles latency and memory footprint, risking OOM in resource-constrained environments.
- **Silent Rollback Invalidation**: If the Rust engine is treated as a "cold" fallback, environment drift (bitrot) may make the fallback fail exactly when needed.
- **CAS Canonicalization Mismatch**: Subtle differences in JSON key ordering or number formatting between engines will break Merkle integrity.
- **Windows Path Sensitivity**: Reach CLI on Windows is vulnerable to quoting and path normalization differences between the Node.js wrapper and the C++ binary.
- **Concurrency Race Conditions**: High-volume parallel calls (1,000+) to a CLI-based engine will likely hit OS process limits (PID exhaustion).
- **Sandbox Escape Potential**: Moving from a WASM-sandboxed Rust engine to a native C++ binary increases the attack surface for path traversal and environment leakage.
- **Observability Gaps**: Current telemetry may not distinguish between "Result Mismatch" (Logic Drift) and "Execution Failure" (Engine Crash) in dual-run mode.
- **Plugin ABI Instability**: External plugins compiled against the Rust ABI will likely break under Requiem without a stable FFI layer.
- **Determinism Under Stress**: High lock contention in Requiem’s internal scheduler could lead to non-deterministic task ordering in "turbo" mode.

---

## 2. Critical Risks (Top 10 Ranked)

| Rank | Risk | Severity | Detection Strategy | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Floating Point Drift** | CRITICAL | Compare full trace outputs, not just recommended actions. | Use fixed-point arithmetic or standardized decimal libraries for utilities. |
| 2 | **Process Limit Exhaustion** | HIGH | Stress test with 1,000+ concurrent `reach decide` calls. | Implement a persistent Engine Daemon mode to avoid fork/exec overhead. |
| 3 | **JSON Canonicalization** | HIGH | Hash the identical input in both engines and compare the CID. | Enforce a strict "Canonical JSON" spec (RFC 8785) in both implementations. |
| 4 | **Incomplete Rollback** | HIGH | Periodic "Fallback Smoke Tests" where Requiem is intentionally disabled. | Automate fallback validation in CI; treat Rust engine as Tier 1 during cutover. |
| 5 | **CAS Directory Race** | MEDIUM | Concurrent writes to the same local artifact cache. | Implement file-system level advisory locks (.lock files) for CAS writes. |
| 6 | **Windows Quoting Drift** | MEDIUM | Cross-platform parity tests with paths containing spaces and special chars. | Use a shared Path Normalization library or strictly use UNC paths. |
| 7 | **Environment Leakage** | MEDIUM | Red-team scan for `env` vars visible in engine debug logs. | Implement a "Secret Stripper" middleware in the EngineAdapter. |
| 8 | **Memory Leakage (C++)** | MEDIUM | Long-running "Serve Mode" soak tests (24h+ duration). | Enforce RAII patterns and run with AddressSanitizer (ASan) in CI. |
| 9 | **Dual-Run Performance** | LOW | Measurement of P99 latency during 10% sampling. | Use "Fire-and-Forget" for the secondary run; compare asynchronously via ledger. |
| 10 | **ABI Version Mismatch** | LOW | Version-gate all EngineAdapter calls. | Include `engine_version` in the request header; fail fast on mismatch. |

---

## 3. Determinism Failure Matrix

| Cause | Symptom | How to Catch Early |
| :--- | :--- | :--- |
| **P-Thread Scheduling** | Non-deterministic ordering in parallel execution graphs. | Run the same graph 100x and compare the execution trace CID. |
| **System Entropy (unseeded)** | Differing outcomes in "Adaptive" mode. | Inject a deterministic seed from Reach CLI into the engine via `ExecRequest`. |
| **IO Ordering (Windows)** | Race conditions when two workers read the same lockfile. | Use the `Strict Deterministic` mode to disable file-system caching for critical runs. |
| **Large Artifact Overload** | Out-of-order event sequences for 100MB+ outputs. | Stream events through a sequence-numbered buffer; verify seq continuity. |
| **Engine Timeout Drift** | One engine succeeds, one fails due to tiny clock differences. | Standardize timeout logic to "Cycles" or "Instructions" rather than wall-clock time. |

---

## 4. Red-Team Checklist

- [ ] **Path Traversal**: Can `artifacts.uri` point outside the workspace (e.g., `../../etc/passwd`)?
- [ ] **Symlink Escape**: Does the engine follow symlinks to sensitive host files?
- [ ] **Env Leakage**: Does `REACH_DEBUG=1` print API keys or Bearer tokens to stdout?
- [ ] **Signal Hijacking**: Does `SIGINT` leave orphaned Requiem zombie processes?
- [ ] **Plugin Injection**: Can a malformed plugin override the `EngineAdapter` singleton?
- [ ] **CAS Poisoning**: Can a secondary run write to a CID that the primary run later reads?
- [ ] **Resource Exhaustion**: Does a 1GB outcome matrix cause a host-level OOM crash?

---

## 5. 6-Month Risk Forecast

| Risk Area | Probability | Impact | Forecast |
| :--- | :---: | :---: | :--- |
| **CAS Scalability** | High | High | Local file-system CAS will choke at 100k+ runs. Transition to S3/GCS backend required. |
| **Adapter Fragmentation** | Medium | Medium | Logic drift between `rust.ts` and `requiem.ts` will lead to "Dual-Run Hell" where 1% of runs always fail mismatch. |
| **Observability Debt** | High | Low | Debugging mismatches in production will be impossible without "Full Replay Capsules" saved on error. |
| **Windows Parity** | Medium | High | Hidden bugs in Windows-specific threading or IO will plague enterprise users on Azure. |
| **Plugin Compatibility** | Low | Medium | Static linking in Requiem will make the plugin ecosystem rigid and hard to extend. |

---

## 6. Surgical Guardrails (Immediate Actions)

1. **Precision Clamp**: Update `translate.ts` to strictly round ALL floating point utilities to 10 decimal places before fingerprinting.
2. **Deterministic Seed Injection**: Modify `ExecRequest` to include a `seed` field derived from the `requestId`. Require Requiem to use this for all RNG calls.
3. **Ghost Comparison**: Implement the dual-run comparison *after* returning the result to the user to eliminate latency impact, logging mismatches to a "Drift Ledger".
4. **Process Guard**: In `EngineAdapter`, wrap CLI calls in a semaphore that caps maximum concurrent engine processes at `min(OS_CPU_COUNT, 32)`.
5. **CID Verification on Read**: Enforce that any artifact read from CAS is re-hashed and compared against its CID *before* it reaches the engine logic.

---

> [!IMPORTANT]
> **Conclusion**: The migration is structurally sound but sensitive to OS-level entropy. The "Dual-Run" mode is your best defense, but only if it compares the **Deterministic Fingerprint** and **Recommended Action** with zero tolerance.
