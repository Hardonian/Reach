# Reach Threat Model & Mitigations

As a deterministic execution engine, Reach is designed to be highly auditable and verifiable. This document outlines the primary threat vectors, abuse scenarios, and the architectural mitigations required to maintain trust in the system.

## 1. Malicious or Compromised Plugins
**Scenario:** A user executes a workflow containing a malicious custom plugin (WASM, JS, or external binary) designed to exfiltrate data, mine cryptocurrency, or alter host system state.
**Mitigations:**
- **Strict Isolation:** All plugins must execute within a strict sandbox (e.g., WASM runtime or Deno/V8 isolations) with **zero default access** to network, file system, or environment variables.
- **Capability Registration:** If a plugin requires external I/O (e.g., HTTP fetch), it must explicitly request this capability in its schema, requiring host node approval and routing through the Reach engine's controlled proxy.

## 2. Tampered Bundles / Capsules
**Scenario:** An attacker modifies a compiled decision bundle or an exported Execution Capsule to bypass a governance policy or forge an approval.
**Mitigations:**
- **Cryptographic Signatures:** Execution Capsules are cryptographically signed (e.g., via Ed25519) upon export.
- **Verification Gate:** The `reachctl proof` and `reachctl verify` commands cryptographically validate the capsule signature against the author's public key before allowing execution or trust ingestion.

## 3. Replay Poisoning
**Scenario:** A malicious actor directly edits the SQLite database or JSON transcript on disk, injecting a forged event or altering historical context to change the outcome of a replayed decision.
**Mitigations:**
- **Hash Chaining:** Each event in a workflow transcript contributes to the subsequent state. 
- **Deterministic Fingerprints:** Replaying the transcript regenerates the canonical output and its SHA-256 fingerprint. Any tampering of prior events results in a divergence of the final fingerprint, immediately flagging the replay as invalid.

## 4. Denial of Service (DoS) Vectors
**Scenario:** An attacker crafts a payload with extreme branching logic, massive strings, or infinite loops to exhaust the node's CPU or memory (Resource Exhaustion).
**Mitigations:**
- **Bounded Execution:** Enforce strict timeout thresholds (e.g., 50ms-100ms) for any single decision evaluation.
- **Payload Limits:** Reject JSON inputs or configuration schemas exceeding a defined byte size (e.g., 5MB).
- **Depth Limits:** Cap the maximum depth of junction trees and recursive evaluation paths to prevent stack overflows.

## 5. Configuration Manipulation
**Scenario:** An attacker with local access modifies `.zeo` configuration files, policy packs, or RBAC definitions to elevate privileges or bypass gating rules.
**Mitigations:**
- **Policy Checksums:** The engine should optionally verify checksums of policy-packs against a known-good external registry (GitOps validation).
- **Read-Only Engine Execution:** The `reachctl runner` should operate with the principle of least privilege, requiring only Read access to configuration directories, while state mutations are isolated to the `runs` directory.

---
*Reach: Reducing entropy in autonomous systems.*
