# Proof Bundles

**Version:** proof.bundle.v1  
**Status:** Production Ready

---

## Overview

Proof bundles provide verifiable, self-contained evidence of execution. They contain cryptographic digests of all inputs and outputs, enabling independent verification without exposing sensitive data.

---

## Bundle Structure

```typescript
interface ProofBundle {
  version: 'proof.bundle.v1';
  bundleId: string;           // Unique identifier
  timestamp: string;          // ISO 8601
  requestId: string;          // Original request ID
  
  merkleRoot: string;         // Root hash of all artifacts
  
  inputs: {
    params: CID;              // Input parameters digest
    policy: CID;              // Policy digest
    context?: CID;            // Optional context
    extras?: ArtifactRef[];   // Additional inputs
  };
  
  outputs: {
    result: CID;              // Output digest
    transcript: CID;          // Execution transcript
    trace?: CID;              // Debug trace
    extras?: ArtifactRef[];   // Additional outputs
  };
  
  engine: {
    type: string;             // 'requiem', 'rust', 'ts'
    version: string;          // Engine version
    protocolVersion: string;  // Protocol version
    contractVersion: string;  // Contract version
  };
  
  signature?: SignatureMetadata;
  
  metadata: {
    durationMs: number;
    algorithm: string;
    tenantHash?: string;
  };
}
```

---

## Merkle Tree

Bundles use a Merkle tree to ensure tamper-evident storage:

```
                    [Merkle Root]
                         |
         +---------------+---------------+
         |                               |
    [Hash AB]                       [Hash CD]
         |                               |
    +----+----+                   +------+------+
    |         |                   |             |
[Hash A]  [Hash B]           [Hash C]      [Hash D]
    |         |                   |             |
  CID A     CID B               CID C         CID D
  (params)  (policy)            (result)      (transcript)
```

- All CIDs are sorted alphabetically before tree construction
- Leaf nodes prefixed with `0x00`
- Branch nodes prefixed with `0x01`
- Deterministic across platforms

---

## CLI Commands

### Create Proof Bundle

```bash
reach proof create <request-id>
```

Creates a proof bundle from execution data stored in `.reach/executions/`.

### Verify Bundle Consistency

```bash
reach proof verify --bundle <file>
```

Verifies internal consistency:
- Merkle root matches recomputed value
- All required fields present
- CID format valid
- Bundle ID valid
- Deterministic serialization

### Export Bundle

```bash
reach proof export <bundle-id> --output <file>
```

Exports bundle to a file for sharing or archival.

### Sign Bundle

```bash
reach proof sign --bundle <file> --key-id <key>
```

Signs bundle using configured signer plugin. See [SIGNING.md](SIGNING.md).

---

## Verification

### Internal Consistency

```typescript
import { verifyBundleConsistency } from './src/engine/proof/bundle.js';

const result = verifyBundleConsistency(bundle);
// result.valid: boolean
// result.errors: string[]
// result.warnings: string[]
```

### Full Verification

For full verification (checking artifacts exist in CAS):

```typescript
import { getCAS } from './src/engine/storage/cas.js';

const cas = getCAS();

// Verify each artifact exists
const params = await cas.get(bundle.inputs.params);
const result = await cas.get(bundle.outputs.result);
```

---

## Storage

Bundles are stored in `.reach/proofs/`:

```
.reach/
├── proofs/
│   ├── abc123.proof.json
│   └── def456.proof.json
└── executions/
    └── <request-id>.json
```

---

## Determinism

Bundles are deterministic:

1. **Sorted CIDs** — All artifacts sorted alphabetically before Merkle tree construction
2. **Canonical JSON** — Keys sorted, no extra whitespace
3. **Stable timestamps** — Bundle uses bundle creation time, not execution time
4. **No secrets** — Only digests, never actual content

---

## Example Bundle

```json
{
  "version": "proof.bundle.v1",
  "bundleId": "a1b2c3d4e5f6...",
  "timestamp": "2026-02-26T21:00:00Z",
  "requestId": "req_abc123",
  "merkleRoot": "f6e5d4c3b2a1...",
  "inputs": {
    "params": "abc123...",
    "policy": "def456..."
  },
  "outputs": {
    "result": "ghi789...",
    "transcript": "jkl012..."
  },
  "engine": {
    "type": "requiem",
    "version": "1.0.0",
    "protocolVersion": "1.0.0",
    "contractVersion": "1.0.0"
  },
  "metadata": {
    "durationMs": 150,
    "algorithm": "minimax_regret"
  }
}
```

---

## CID Format

Content Identifiers are BLAKE3 or SHA-256 hashes:

- Hexadecimal string
- 64 characters for SHA-256
- 128 characters for BLAKE3
- Lowercase

---

## Programmatic Usage

```typescript
import {
  createProofBundle,
  verifyBundleConsistency,
  exportBundle,
  importBundle,
  computeBundleCID,
} from './src/engine/proof/bundle.js';

// Create bundle
const bundle = createProofBundle({
  requestId: 'req_123',
  inputs: { params: cid1, policy: cid2 },
  outputs: { result: cid3, transcript: cid4 },
  engine: { type: 'requiem', version: '1.0.0', protocolVersion: '1.0.0', contractVersion: '1.0.0' },
  metadata: { durationMs: 100, algorithm: 'minimax_regret' },
});

// Verify
const { valid, errors } = verifyBundleConsistency(bundle);

// Export
exportBundle(bundle, './proof.json');

// Import
const loaded = importBundle('./proof.json');

// Get CID
const cid = computeBundleCID(bundle);
```

---

## Security Considerations

1. **Tamper Evidence** — Merkle root detects any modification
2. **No Secrets** — Only digests, never actual content
3. **Deterministic** — Same execution always produces same bundle
4. **Verifiable** — Independent verification without trust

---

## Integration with CAS

Proof bundles integrate with Content Addressable Storage:

```
Execution → CAS.put(input) → CID
          → CAS.put(output) → CID
          → createProofBundle(CIDs) → Bundle
          → CAS.put(bundle) → Bundle CID
```

This enables:
- Deduplication (same content = same CID)
- Verification (retrieve by CID, verify hash)
- Audit trail (immutable history)
