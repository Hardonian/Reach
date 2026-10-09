# API Surface Contract

**Version:** 1.0.0
**Status:** FROZEN
**Scope:** Public API Stability Guarantees

---

## 1. Stability Levels

| Level            | Icon | Guarantee           | Breaking Change Policy              |
| ---------------- | ---- | ------------------- | ----------------------------------- |
| **Frozen**       | 🔒   | Never changes       | N/A                                 |
| **Stable**       | ✅   | Backward compatible | Deprecation + 2 minor versions      |
| **Experimental** | 🧪   | May change          | Removal with 1 minor version notice |
| **Internal**     | ⚠️   | No guarantees       | May change anytime                  |

---

## 2. Frozen API Surface (🔒)

### 2.1 Determinism Package (`services/runner/internal/determinism`)

```go
// Hash computes SHA-256 of canonical JSON representation
func Hash(v any) string

// CanonicalJSON returns deterministic JSON with sorted keys
func CanonicalJSON(v any) string

// VerifyReplay checks if replayed event log matches fingerprint
func VerifyReplay(eventLog []map[string]any, runID string, expectedFingerprint string) bool
```

**Stability:** Frozen v1.0.0
**Rationale:** Core of the deterministic guarantee. Changes would invalidate all historical fingerprints.

### 2.2 Pack Integrity Package (`services/runner/internal/pack`)

```go
// ComputePackIntegrity computes Merkle tree for pack manifest
func ComputePackIntegrity(manifest *PackManifest, graphData []byte) (*PackIntegrity, error)

// VerifyProof verifies a Merkle proof against a root hash
func VerifyProof(proof *MerkleProof, rootHash []byte) bool

// RootHash returns the Merkle root hash
func (mt *MerkleTree) RootHash() []byte
```

**Stability:** Frozen v1.0.0
**Rationale:** Content-addressing foundation. Changes would break pack verification.

### 2.3 Protocol Schemas (`protocol/schemas/`)

| Schema                 | Status | Key Fields                |
| ---------------------- | ------ | ------------------------- |
| `events.schema.json`   | 🔒     | All event types frozen    |
| `artifact.schema.json` | 🔒     | Patch format frozen       |
| `toolcall.schema.json` | 🔒     | Call/Result format frozen |

**Stability:** Frozen v1.0.0
**Rationale:** Wire format compatibility across versions.

---

## 3. Stable API Surface (✅)

### 3.1 Engine Client (`services/runner/internal/engineclient`)

```go
type Client interface {
    Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error)
    Health(ctx context.Context) (*HealthStatus, error)
    Close() error
}
```

**Stability:** Stable
**Deprecation:** 2 minor versions notice required

### 3.2 Storage Driver Interface (`services/runner/internal/storage`)

```go
type StorageDriver interface {
    Get(ctx context.Context, key string) ([]byte, error)
    Put(ctx context.Context, key string, value []byte) error
    Delete(ctx context.Context, key string) error
    List(ctx context.Context, prefix string) ([]string, error)
}
```

**Stability:** Stable
**Note:** Interface may be extended (new methods) but not modified

### 3.3 Policy Gate Interface (`services/runner/internal/policy`)

```go
type Gate interface {
    Evaluate(ctx context.Context, req *DecisionRequest) (*Decision, error)
    Name() string
}
```

**Stability:** Stable
**Rationale:** Plugin ecosystem depends on this

---

## 4. Experimental API Surface (🧪)

### 4.1 Adaptive Strategy (`services/runner/internal/adaptive`)

```go
// StrategySelector chooses execution strategy based on context
// EXPERIMENTAL: API may change as strategy engine evolves
type StrategySelector interface {
    Select(ctx context.Context, task *Task) (Strategy, error)
}
```

**Stability:** Experimental
**Expected Stabilization:** v0.5.0

### 4.2 Federation (`services/runner/internal/federation`)

```go
// DelegationClient handles cross-node delegation
// EXPERIMENTAL: Protocol under active development
type DelegationClient interface {
    Delegate(ctx context.Context, req *DelegationRequest) (*DelegationResponse, error)
}
```

**Stability:** Experimental
**Expected Stabilization:** v0.6.0

---

## 5. Internal API Surface (⚠️)

These packages are **not** part of the public API:

- `services/runner/internal/telemetry/*`
- `services/runner/internal/mesh/*`
- `services/runner/internal/mcpserver/*`
- `services/runner/internal/backpressure/*`

**Warning:** Direct use of internal APIs is unsupported and may break without notice.

---

## 6. Version Compatibility Matrix

| Reach Version | Frozen APIs   | Stable APIs   | Experimental APIs |
| ------------- | ------------- | ------------- | ----------------- |
| v0.3.x        | ✅ Compatible | ✅ Compatible | 🧪 May change     |
| v0.4.x        | ✅ Compatible | ✅ Compatible | 🧪 May change     |
| v1.0.x        | ✅ Frozen     | ✅ Compatible | ✅ Stabilized     |

---

## 7. Breaking Change Detection

The following changes are **always** breaking:

| Change Type               | Severity | Example                          |
| ------------------------- | -------- | -------------------------------- |
| Remove exported function  | Breaking | `Delete Hash()`                  |
| Change function signature | Breaking | `Hash(v any)` → `Hash(v []byte)` |
| Change return type        | Breaking | `string` → `[]byte`              |
| Modify frozen schema      | Breaking | Add required field to event      |
| Change hash algorithm     | Breaking | SHA-256 → BLAKE3                 |

The following changes are **backward compatible**:

| Change Type               | Severity   | Example                          |
| ------------------------- | ---------- | -------------------------------- |
| Add new function          | Compatible | New `HashBatch()`                |
| Extend interface          | Compatible | Add optional method with default |
| Add optional schema field | Compatible | New optional event property      |
| Performance improvement   | Compatible | Faster `Hash()` implementation   |

---

## 8. API Evolution Process

```
┌─────────────────────────────────────────────────────────────┐
│  1. Proposal                                                │
│     - RFC document in docs/rfcs/                            │
│     - Impact assessment on frozen APIs                      │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Review                                                  │
│     - Architecture review board                             │
│     - Compatibility analysis                                │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Deprecation (if applicable)                             │
│     - Mark old API as deprecated                            │
│     - Add runtime warning                                   │
│     - Wait 2 minor versions                                 │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Implementation                                          │
│     - New API with backward compat shim                     │
│     - Comprehensive tests                                   │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Freeze (if applicable)                                  │
│     - Add 🔒 marker to this document                        │
│     - Update version history                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Enforcement

API contracts are enforced by:

1. **Static Analysis:** `scripts/validate-api-surface.ts`
2. **Compatibility Tests:** `tests/api-compatibility/`
3. **CI Gate:** `api-surface-check` required check

---

## 10. Reference

| Document                  | Purpose                           |
| ------------------------- | --------------------------------- |
| `DETERMINISM_SPEC.md`     | Detailed determinism requirements |
| `DETERMINISM_MANIFEST.md` | Versioned manifest                |
| `BOUNDARIES.md`           | System layering                   |
| `IMPORT_RULES.md`         | Import restrictions               |

---

**Last Updated:** 2026-02-26
**Contract Version:** 1.0.0
**Status:** FROZEN
