# Signed Execution Pack Specification

An **Execution Pack** is the immutable unit of deployment for an agentic task. It bundles the declared intent, required capabilities, and cryptographic proof of integrity to ensure safe, reproducible execution.

## Data Structure

```go
type ExecutionPack struct {
    Metadata            PackMetadata      `json:"metadata"`
    DeclaredTools       []string          `json:"declared_tools"`       // Whitelist of tools allowed
    DeclaredPermissions []string          `json:"declared_permissions"` // Whitelist of permissions
    ModelRequirements   ModelReqs         `json:"model_requirements"`   // e.g. { "tier": "high" }
    ExecutionGraph      json.RawMessage   `json:"execution_graph"`      // The blueprint/plan (optional/pre-compiled)
    DeterministicFlag   bool              `json:"deterministic"`        // Enforce deterministic seed/logic
    SignatureHash       string            `json:"signature_hash"`       // HMAC/Sig of the above fields
}

type PackMetadata struct {
    ID          string `json:"id"`
    Version     string `json:"version"`
    Name        string `json:"name"`
    Description string `json:"description"`
    Author      string `json:"author"`
    Created     string `json:"created"` // ISO8601
}
```

## Integrity & Security

### 1. Hash-Based Integrity
The `SignatureHash` is calculated over the canonical JSON representation of all fields *except* `SignatureHash`. Attempting to load a pack where the computed hash differs from the stored hash results in a `ManifestIntegrityError`.

### 2. Versioning
Packs are strictly versioned. Replay operations MUST reference the exact version used in the original run.

### 3. Replayable RunID
When a session is initialized from a pack, the `RunID` is cryptographically linked to the pack's `SignatureHash` and the `InitialContext`. This ensures that a "replay" is dealing with the exact same definitions.

### 4. Immutability
Once loaded, a pack struct is read-only. The execution engine does not modify the pack.

### 5. No Implicit Tool Access
The Executor is initialized with the `DeclaredTools` and `DeclaredPermissions` from the pack.
- Calls to tools NOT in `DeclaredTools` fail immediately with `SecurityViolation`.
- Calls requiring permissions NOT in `DeclaredPermissions` fail immediately.

## Marketplace Containment

Packs downloaded from the marketplace:
1.  Must be signed by a trusted key (if applicable) or validated against the Registry.
2.  Are inspected for "elevated privileges" (e.g. `filesystem:write` outside sandbox).
3.  Are run in a sandboxed Executor instance that enforces the declared constraints.
