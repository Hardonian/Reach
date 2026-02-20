# Reach STRIDE Threat Model ## Scope and assumptions

This model covers the security-critical control surfaces currently present in Reach OSS:

- Pack signing and integrity validation in `engine-core` and runner plugin verification.
- Policy gate decisions in runner policy evaluator.
- Federation delegation acceptance path.
- Replay integrity and snapshot guard behavior.
- Audit trail persistence and retrieval.
- Spec version compatibility enforcement.

The model references concrete implementation behavior in:

- `crates/engine-core/src/invariants/mod.rs`
- `crates/engine-core/src/lib.rs`
- `services/runner/internal/policy/gate.go`
- `services/runner/internal/mesh/delegation.go`
- `services/runner/internal/spec/version.go`
- `services/runner/internal/plugins/verify.go`
- `services/runner/internal/storage/storage.go`

---

## 1) Pack signing system ### Assets

- Canonical pack payload bytes.
- Pack signature/hash binding.
- Trusted signer key registry (`PLUGIN_TRUSTED_KEYS`).
- Manifest and detached signature metadata.

### Trust boundaries - Untrusted pack producer -> runner acceptance path.
- Untrusted plugin manifest/signature files -> signature verifier.
- Environment configuration (`REACH_ALLOW_LEGACY_UNSIGNED_PACKS`, `DEV_ALLOW_UNSIGNED`) -> enforcement mode.

### STRIDE threats - **Spoofing**: attacker impersonates trusted signer key ID.
- **Tampering**: manifest or pack payload modified post-sign.
- **Repudiation**: signer denies authorship absent durable provenance logs.
- **Information Disclosure**: leaked key material via weak ops handling.
- **DoS**: malformed signature payloads induce verifier failure loops.
- **Elevation of Privilege**: unsigned legacy pack accepted in permissive mode.

### Impact Execution of forged or tampered packs, policy bypass preconditions, compromised connector/plugin supply chain.

### Existing mitigations - Canonical payload hash/signature matching gate in engine-core invariants.
- Runner policy rejects unsigned packs unless explicit legacy override is enabled.
- Plugin verifier requires known key ID and verifies RSA PKCS#1v1.5 SHA-256 signature.
- Unknown signer key and malformed PEM are hard failures.

### Residual risk - Hash-only signature model in `engine-core` (`signature == canonical_hash`) is integrity-checking but not cryptographic identity proof.
- Legacy unsigned toggles are potential misconfiguration risk in non-prod-hardening setups.
- No explicit key rotation cadence documented for plugin trusted key set.

---

## 2) Policy gate ### Assets

- Organization policy (allowed permissions/models, determinism requirement, version).
- Declared pack tools and permission scopes.
- Runtime requested tools/permissions.

### Trust boundaries - Client-supplied or orchestrator-propagated requests -> policy evaluator.
- Environment-derived policy mode (`warn` vs `enforce`) -> deny/allow semantics.

### STRIDE threats - **Spoofing**: forged node/tenant context if upstream auth weak.
- **Tampering**: request mutates requested scopes after preflight.
- **Repudiation**: actor denies performing denied/allowed request.
- **Information Disclosure**: raw hashes/node IDs leaked via policy responses.
- **DoS**: repeated policy failures as noisy attack path.
- **Elevation of Privilege**: undeclared tool or permission escalation accepted.

### Impact Unauthorized tool execution, model policy violations, non-deterministic runs in deterministic-required environments.

### Existing mitigations - Explicit deny reasons for signature, undeclared tools, permission escalation, model mismatch, determinism requirement.
- Scope checks require both pack declaration and org policy allowance.
- Redaction helper masks pack hash and node ID in policy output.
- CI/production defaults policy mode to enforce.

### Residual risk - `warn` mode can be selected in non-CI/non-prod environments and may allow risky behavior if misused.
- Policy version is data-carried but no cryptographic policy bundle attestation.

---

## 3) Federation delegation ### Assets

- Delegation request envelope (`GlobalRunID`, `OriginNodeID`, `RegistryHash`, `SpecVersion`).
- Local registry snapshot hash.
- Delegation depth and TTL constraints.

### Trust boundaries - Remote federation peer -> `AcceptDelegation` endpoint.
- Local registry compatibility checker -> delegated pack acceptance.

### STRIDE threats - **Spoofing**: malicious node claiming trusted origin.
- **Tampering**: altered delegation payload fields in transit.
- **Repudiation**: peer disputes rejected/accepted delegation.
- **Information Disclosure**: federation metadata leakage via logs.
- **DoS**: recursion/depth abuse and repeated failing delegations.
- **Elevation of Privilege**: delegating incompatible or unsigned packs.

### Impact Cross-node trust compromise, invalid execution acceptance, mesh instability.

### Existing mitigations - Delegation depth hard limit (default 5).
- Recursive self-delegation rejection.
- Registry snapshot hash mismatch rejection.
- Spec major compatibility enforced.
- Pack integrity and registry compatibility revalidated by receiver.
- Circuit breaker tracks peer failures and opens on repeated faults.

### Residual risk - TTL is carried but not directly enforced inside `AcceptDelegation` beyond context cancellation behavior.
- No mutual attestation channel in this OSS path (e.g., mTLS identity pinning is not in this code path).

---

## 4) Replay engine ### Assets

- Deterministic event log sequence.
- Snapshot hash for replay guard.
- Replay state and error surface.

### Trust boundaries - Persisted run/event stream -> replay runtime.
- Caller-provided expected/replay snapshot hashes -> guard decision.

### STRIDE threats - **Spoofing**: forged source events.
- **Tampering**: modified event order or snapshot hash mismatch.
- **Repudiation**: actor denies altered replay inputs.
- **Information Disclosure**: replayed payloads may expose sensitive artifacts if not filtered upstream.
- **DoS**: oversized replay streams.
- **Elevation of Privilege**: forcing replay acceptance despite mismatch.

### Impact Loss of deterministic reproducibility and forensic confidence.

### Existing mitigations - Replay path enforces snapshot hash equality before accepting replay-with-guard.
- Deterministic event equality invariant tested in unit tests.

### Residual risk - Replay integrity currently validates equality but does not include signed provenance chain over event stream.
- Potential memory pressure with large events is not bounded in engine-core replay function.

---

## 5) Audit trail ### Assets

- Tenant-scoped audit rows (`tenant_id`, `run_id`, `payload`, timestamps).
- Ordered event stream IDs.

### Trust boundaries - Authenticated API calls -> append/list audit.
- SQLite storage -> retrieval for auditors and tooling.

### STRIDE threats - **Spoofing**: non-tenant actor attempts cross-tenant read/write.
- **Tampering**: direct DB mutation or payload modification.
- **Repudiation**: event author denies recorded action.
- **Information Disclosure**: unauthorized audit retrieval.
- **DoS**: audit flooding and storage exhaustion.
- **Elevation of Privilege**: bypass tenant scoping in queries.

### Impact Broken non-repudiation, compliance failure, weak post-incident investigations.

### Existing mitigations - Storage list queries require `(tenant_id, run_id)` filter.
- Events and audit are appended with server-generated timestamps.
- API routes for audit retrieval are behind auth middleware.

### Residual risk - No immutable/WORM backend; SQLite is mutable by privileged host actors.
- No explicit cryptographic hash-chain of audit entries in storage layer.

---

## 6) Spec version enforcement ### Assets

- Runner spec version constant (`1.0.0`).
- Incoming request declared spec version.

### Trust boundaries - External caller/federated peer -> version parser and compatibility checker.

### STRIDE threats - **Spoofing**: client lies about compatible version.
- **Tampering**: downgraded/altered version metadata.
- **Repudiation**: client disputes mismatch handling.
- **Information Disclosure**: version fingerprints in error messages.
- **DoS**: malformed version strings causing parse churn.
- **Elevation of Privilege**: exploiting lax compatibility rules.

### Impact Protocol drift, unsafe behavior if incompatible semantics are accepted.

### Existing mitigations - Empty or malformed versions are rejected.
- Major-version mismatch is rejected.

### Residual risk - Minor/patch semantic compatibility is not deeply validated at this layer.
- No per-feature negotiation yet, only coarse major gate.

---

## Priority hardening backlog 1. Replace non-cryptographic `DefaultHasher`-based canonical hash check with formal signature verification tied to issuer identity for execution packs.
2. Enforce delegation TTL explicitly in `AcceptDelegation` using server-side wall-clock checks.
3. Add tamper-evident audit hash chaining (per-run Merkle or append-only hash link).
4. Add policy bundle signing/version attestation to prevent policy-source tampering.
5. Add replay input size and event-count limits with deterministic truncation behavior.
