# Reach Protocol Specification v1.0.0

**Status:** NORMATIVE  
**Effective Date:** 2026-02-18  
**specVersion:** 1.0.0  

---

## 1. Scope

This document defines the Reach Protocol v1.0.0, a formal specification for deterministic, auditable, and federated execution of agentic tasks. It specifies:

- Execution model and lifecycle semantics
- Policy enforcement requirements
- Pack structure and validation
- Federation semantics
- Error classification and guarantees
- Artifact requirements

## 2. Conformance

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in RFC 2119.

A conforming implementation MUST:
1. Satisfy all MUST-level requirements
2. Produce valid output for all conformance test cases
3. Maintain backward compatibility within major versions

## 3. Execution Model

### 3.1 Run Lifecycle

A **Run** represents a single execution of a Reach Pack. The lifecycle consists of the following states:

```
PENDING → PREPARING → EXECUTING → COMPLETED
              ↓           ↓
         FAILED      ABORTED
```

**State Definitions:**

- **PENDING** (initial): Run has been accepted but not yet prepared
- **PREPARING**: Environment setup, dependency resolution, policy validation
- **EXECUTING**: Active tool execution within sandbox
- **COMPLETED**: All steps executed successfully, artifacts produced
- **FAILED**: Execution halted due to error or policy violation
- **ABORTED**: Execution terminated by external signal

**Transitions:**

| From → To | Trigger | MUST Guarantee |
|-----------|---------|----------------|
| PENDING → PREPARING | Valid pack received | Input hash recorded |
| PREPARING → EXECUTING | Policy validation passed | Capability manifest locked |
| EXECUTING → COMPLETED | All steps succeed | Output hash committed |
| EXECUTING → FAILED | Error or violation | Error code emitted, partial state captured |
| Any → ABORTED | SIGTERM/SIGINT received | Graceful cleanup within 30s |

### 3.2 Event Ordering

Events within a Run MUST be emitted in the following order:

1. `run.started` - Run initialization complete
2. `run.step.started` - Individual step begins (one per step)
3. `tool.invoked` - Tool execution requested
4. `tool.completed` | `tool.failed` - Tool result
5. `run.step.completed` | `run.step.failed` - Step result
6. `run.completed` | `run.failed` - Run termination

**Ordering Guarantees:**

- Events for a single step MUST NOT interleave with other steps
- Tool events MUST be nested within their enclosing step
- Run termination MUST follow all step events

### 3.3 Deterministic Hash Rules

Each Run MUST produce a deterministic hash that uniquely identifies its execution. The hash is computed as:

```
runHash = SHA256(orderedEventHashes)
eventHash = SHA256(eventType || timestamp || payloadHash || prevEventHash)
```

**Determinism Requirements:**

1. **Timestamp Normalization**: All timestamps MUST be ISO 8601 UTC with millisecond precision
2. **Payload Ordering**: Object keys MUST be sorted lexicographically
3. **Array Stability**: Arrays MUST maintain insertion order
4. **No Non-Deterministic Fields**: Random IDs, memory addresses, or pointer values MUST NOT appear in hashed payload

**Replay Guarantee**: Given identical inputs and identical initial state, a conforming implementation MUST produce identical run hashes.

### 3.4 Replay Guarantees

A Run is **replayable** if:

1. All tool invocations are recorded with their inputs
2. All external state access is captured
3. All non-deterministic sources (time, random) are mocked

**Replay Requirements:**

- A replayed Run MUST produce the same run hash as the original
- Replay MAY skip actual tool execution if outputs are recorded
- Replay MUST validate recorded outputs match expected hashes

## 4. Policy Enforcement Model

### 4.1 Declaration Requirements

Before execution, a Pack MUST declare:

1. **Capabilities**: Tools and resources the Pack intends to use
2. **Policies**: Constraints on execution (timeouts, rate limits)
3. **Dependencies**: External packs or resources required

**Declaration Schema:**

```json
{
  "capabilities": {
    "tools": ["tool.name"],
    "resources": ["resource://path"],
    "permissions": ["read", "write"]
  },
  "policies": {
    "maxExecutionTime": 300000,
    "maxToolCalls": 100,
    "allowedHosts": ["*.example.com"]
  }
}
```

### 4.2 Capability Enforcement Semantics

The runtime MUST enforce capability restrictions:

- **Tool Allowlist**: Only declared tools MAY be invoked
- **Resource Boundaries**: Access outside declared resources MUST fail
- **Permission Checks**: Each operation MUST verify required permissions

**Enforcement Points:**

1. Pre-execution: Validate all declared capabilities are satisfiable
2. Per-invocation: Verify tool is in allowlist
3. Post-execution: Audit actual vs declared capability usage

### 4.3 Denial Behavior Requirements

When a capability check fails:

1. **Immediate Halt**: Current step MUST terminate
2. **Structured Error**: Error MUST include:
   - `code`: "POLICY_VIOLATION"
   - `violationType`: "UNDEFINED_TOOL" | "RESOURCE_ACCESS" | "PERMISSION_DENIED"
   - `details`: Specific capability attempted
3. **Audit Trail**: Violation MUST be recorded in run events
4. **No Partial Effects**: Partial tool effects MUST be rolled back

## 5. Pack Structure

### 5.1 Required Fields

A valid Reach Pack MUST contain:

| Field | Type | Description |
|-------|------|-------------|
| `specVersion` | string | Protocol version (semver) |
| `id` | string | Unique pack identifier |
| `version` | string | Pack version (semver) |
| `manifest` | object | Capability declarations |
| `entrypoint` | string | Path to main execution file |

### 5.2 specVersion

The `specVersion` field declares the protocol version the pack targets:

- Format: `MAJOR.MINOR.PATCH` per SemVer 2.0.0
- Current: `1.0.0`
- Runtime MUST reject packs with unsupported major versions

### 5.3 Manifest Schema

The manifest declares capabilities and metadata:

```json
{
  "manifestVersion": "1.0.0",
  "capabilities": {
    "tools": [{ "name": "string", "version": "string" }],
    "resources": [{ "uri": "string", "access": "read|write" }]
  },
  "metadata": {
    "author": "string",
    "description": "string",
    "license": "SPDX-Identifier"
  }
}
```

### 5.4 Signing Requirements

Packs SHOULD be signed for integrity verification:

- **Signature Algorithm**: Ed25519
- **Digest Algorithm**: SHA-256
- **Signature Location**: `.reach/signature` file
- **Verification**: Runtime MUST verify signature before execution if present

## 6. Federation Semantics

### 6.1 Node Identity Model

Each federation node has:

- **Node ID**: Unique identifier (UUID v4)
- **Public Key**: Ed25519 public key for authentication
- **Endpoint**: HTTPS URL for federation communication

**Identity Requirements:**

- Node ID MUST be persistent across restarts
- Public key MUST be registered in federation registry
- All federation messages MUST be signed

### 6.2 Delegation Contract

Delegation allows one node to execute on behalf of another:

```json
{
  "delegation": {
    "delegator": "node-id",
    "delegate": "node-id",
    "scope": ["capability1", "capability2"],
    "expiresAt": "2026-12-31T23:59:59Z",
    "signature": "..."
  }
}
```

**Delegation Rules:**

1. Delegation MUST be explicitly granted
2. Scope MUST be a subset of delegator's capabilities
3. Expiration MUST be enforced
4. Signature MUST verify against delegator's public key

### 6.3 Trust Boundary Rules

Trust boundaries define security domains:

- **Intra-node**: Within same node, full trust
- **Inter-node**: Cross-node, verify all signatures
- **Delegated**: Trust based on delegation chain

**Trust Requirements:**

- Untrusted nodes MUST NOT access sensitive capabilities
- Delegation chains MUST be validated at each hop
- Revoked delegations MUST be honored within 60 seconds

## 7. Error Model

### 7.1 Error Code Namespace

Error codes follow the pattern: `CATEGORY_SUBCATEGORY_DETAIL`

**Categories:**

| Category | Prefix | Description |
|----------|--------|-------------|
| Protocol | `PROTO_` | Protocol-level errors |
| Policy | `POLICY_` | Policy violations |
| Execution | `EXEC_` | Runtime execution errors |
| Federation | `FED_` | Federation communication errors |
| Pack | `PACK_` | Pack validation errors |

### 7.2 Error Classification Guarantees

**Hard Failures** (MUST terminate run):
- `PROTO_VERSION_MISMATCH`
- `POLICY_VIOLATION`
- `PACK_INVALID_SIGNATURE`

**Soft Failures** (MAY be recoverable):
- `EXEC_TOOL_TIMEOUT`
- `EXEC_RESOURCE_UNAVAILABLE`
- `FED_NODE_UNREACHABLE`

**Error Response Structure:**

```json
{
  "error": {
    "code": "CATEGORY_DETAIL",
    "message": "Human-readable description",
    "details": {},
    "recoverable": false,
    "retryAfter": null
  }
}
```

## 8. Artifact Guarantees

### 8.1 Time Capsule Requirements

Time capsules preserve execution state for replay:

**Required Contents:**
1. Run events (complete, ordered)
2. Tool inputs and outputs
3. External state snapshots
4. Pack manifest and code

**Format:**
- Container: TAR archive
- Compression: gzip
- Naming: `{runHash}.capsule.tar.gz`

### 8.2 Deterministic Export Requirements

Exported artifacts MUST be deterministic:

1. **Canonical JSON**: Keys sorted, no extra whitespace
2. **Normalized Paths**: Absolute paths converted to relative
3. **Timestamp Freezing**: Timestamps recorded as offsets from run start

### 8.3 Proof Model Expectations

Proofs provide cryptographic verification of execution:

- **Run Proof**: Signed run hash attesting to execution
- **Step Proofs**: Individual step attestations
- **Verification**: Third parties can verify without re-execution

## 9. Versioning Policy

### 9.1 Backward Compatibility

- **Major version changes**: Breaking changes, explicit migration required
- **Minor version changes**: New features, backward compatible
- **Patch version changes**: Bug fixes, no behavior changes

### 9.2 Deprecation Rules

Deprecated features:

1. MUST be documented in CHANGELOG
2. MUST emit warnings when used
3. MUST be supported for minimum 2 minor versions
4. MAY be removed in next major version

### 9.3 Migration Expectations

When specVersion changes:

- Runtime MUST provide clear error messages
- Migration tools SHOULD be provided
- Old format support MAY be maintained via adapter

## 10. Conformance Testing

Implementations MUST pass:

1. **Schema Validation**: All structures validate against JSON Schema
2. **Determinism Tests**: Same input produces same hash
3. **Replay Tests**: Replayed runs match original hashes
4. **Policy Tests**: Undeclared access is blocked
5. **Federation Tests**: Delegation chains validate correctly

---

## Appendix A: Normative References

- RFC 2119: Key words for use in RFCs
- RFC 3339: Date and Time on the Internet
- SemVer 2.0.0: Semantic Versioning
- JSON Schema Draft 2020-12

## Appendix B: Change Log

See [CHANGELOG.md](./CHANGELOG.md)
