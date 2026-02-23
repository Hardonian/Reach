# Reach Execution Specification - **specVersion:** `1.0.0`

- **status:** canonical
- **compatibility model:** semantic versioning, major-version lock

## 1. Scope This document defines the normative execution contract used by runner orchestration, replay, policy admission, audit, and federation delegation.

## 2. Normative contracts ### 2.1 Execution graph rules

1. An execution graph MUST declare a `start_node_id` that exists in `nodes`.
2. Every edge `from` and `to` reference MUST resolve to existing nodes.
3. Graph node identifiers MUST be unique within a graph.
4. Execution MAY only traverse edges declared in the graph definition.
5. Conditional edges MUST include a condition expression.

### 2.2 Pack signing contract 1. A pack MUST include a signature hash over canonical JSON of all pack fields excluding `signature_hash`.

2. A pack MUST include `metadata.spec_version`.
3. A runtime MUST reject any pack whose signature hash does not match its computed canonical hash.
4. A runtime MUST reject packs with incompatible `metadata.spec_version`.

### 2.3 Policy gate contract 1. Policy evaluation MUST deny undeclared tools.

2. Policy evaluation MUST deny permission scopes not declared by pack and policy.
3. Policy evaluation MUST deny unsigned packs unless explicitly allowed by policy.
4. Denials MUST include machine-readable reason codes.

### 2.4 Deterministic replay rules 1. Replay execution MUST validate `context.pack_hash` against loaded pack hash when provided.

2. Replay execution MUST validate `context.registry_snapshot_hash` against runtime snapshot when provided.
3. Replay execution MUST reject incompatible `context.spec_version`.
4. Replay validation errors MUST return deterministic error codes.

### 2.5 Audit emission guarantees 1. Pack admission and denial decisions MUST emit deterministic audit events.

2. Invariant violations MUST emit auditable machine-readable codes.
3. Replay and federation failures MUST emit explicit rejection events.

### 2.6 Federation delegation contract 1. Delegation MUST reject recursion to origin node.

2. Delegation MUST enforce maximum delegation depth.
3. Delegation MUST validate pack integrity before execution.
4. Delegation MUST verify registry snapshot hash continuity.
5. Delegation MUST reject incompatible `spec_version`.

### 2.7 Error state guarantees 1. Contract violations MUST return stable error codes.

2. Rejections MUST be explicit (`status=error` or `status=rejected`) and MUST NOT execute delegated side effects.
3. Validation errors MUST be deterministic for equivalent inputs.

## 3. Versioning and compatibility - The canonical runtime execution spec version is `1.0.0`.

- Compatibility policy is major-version compatible only.
- A major mismatch MUST be rejected during:
  - pack validation,
  - federation handshake verification,
  - execution context validation,
  - delegation request validation.
