# Trust Negotiation Specification

## 1. Overview

Reach nodes establish a mesh of trust through cryptographic handshakes that go beyond identity verification, including capability and policy alignment.

## 2. Handshake Protocol

The handshake is extended to include a "Capability Advertisement":

```go
type CapabilityAdvertisement struct {
    CapabilitiesHash           string
    RegistrySnapshotHash       string
    PolicyVersion              string
    DeterminismSupportLevel    int
    SupportedOptimizationModes []string
}
```

## 3. Verification Rules

Nodes MUST enforce the following rules before establishing a session:

1. **Registry Hash Match**: Nodes must verify that they share a compatible capability registry or reject the handshake.
2. **Policy Alignment**: If the `PolicyVersion` is mismatched, the nodes should refuse execution delegation to prevent policy leakage or violations.
3. **Signature Chain**: The `CapabilitySig` must be a valid signature over the registry snapshot, allowing for offline verification.

## 4. Determinism Levels

- **Level 0 (None)**: No guarantees.
- **Level 1 (Basic)**: Supports seeded randomness and mocked time.
- **Level 2 (Strict)**: Full WASM-level isolation with cycle-accurate replay support.

## 5. Trust Segregation

- **Cross-Org Trust**: Nodes from different OrgIDs require Signed Capability Snapshots and explicit policy negotiation.
- **Intra-Org Trust**: Nodes within the same OrgID may bypass some expensive snapshot validations but must still verify registry hashes.
