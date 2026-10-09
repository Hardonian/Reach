# Federated Execution Specification ## 1. Overview

Reach Federated Execution allows multiple nodes across different organizations to delegate and execute tasks while maintaining deterministic integrity and policy enforcement.

## 2. Delegation Protocol A delegation request MUST include:

- `ExecutionPack`: The signed pack containing the intent and capability requirements.
- `RunID`: Local run unique identifier.
- `GlobalRunID`: Mesh-wide identifier to correlate execution across nodes.
- `OriginNodeID`: Identity of the node that initiated the execution.
- `Deterministic`: Flag indicating if strict deterministic replay is required.
- `DelegationDepth`: Counter to prevent infinite delegation loops.
- `TTL`: Time-to-live for the delegated execution.

## 3. Execution Lifecycle 1. **Advertisement**: Nodes exchange capability snapshots and registry hashes during handshake.

2. **Negotiation**: Node A selects Node B based on capability match and trust level.
3. **Delegation**: Node A sends a signed delegation request to Node B.
4. **Validation**: Node B re-verifies the pack signature, checks local policy, and validates the registry hash.
5. **Execution**: Node B executes the pack within its local envelope.
6. **Audit**: Both nodes emit local audit records with the `GlobalRunID`.

## 4. Replay Integrity To ensure `Cross-Node Replay Integrity`, the protocol enforces:

- **Registry Snapshots**: Replay must use a registry compatible with the original `RegistrySnapshotHash`.
- **Policy Version**: Policy enforcement must match the version active during the original run.
- **Node Provenance**: Every tool execution record contains `OriginNodeID` and `ExecutionNodeID`.

## 5. Failure Containment - **Circuit Breaker**: Nodes track failure rates of peers and temporarily suspend delegation if a threshold is exceeded.

- **Depth Limit**: Maximum delegation depth is strictly enforced (default: 5).
- **TTL Enforcement**: Delegated runs are terminated if they exceed the specified TTL.
