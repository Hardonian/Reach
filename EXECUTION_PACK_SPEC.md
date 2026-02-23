# Signed Execution Pack Specification ## Overview

An **Execution Pack** is a portable, verifiable, and immutable container for agentic workflows. It bundles the intent, constraints, and logic required to execute a task, signed to prevent tampering.

## File Format (`.reachpack`) The pack is serialized as a JSON object containing the Manifest and the Signature.

```json
{
  "metadata": { ... },
  "declared_tools": [ ... ],
  "declared_permissions": [ ... ],
  "model_requirements": { ... },
  "execution_graph": { ... },
  "deterministic": true,
  "signature_hash": "sha256:..."
}
```

## Detailed Structure ### 1. Metadata (`metadata`)

Identifies the pack.

```json
{
  "id": "com.acme.datapipe",
  "version": "1.0.2",
  "name": "Data Pipeline Cleaner",
  "description": "Cleans CSV files in data dir",
  "author": "verified_publisher",
  "created": "2024-01-01T12:00:00Z"
}
```

### 2. Constraints (`declared_tools`, `declared_permissions`) Explicit allowlists.

- `declared_tools`: Array of tool names (e.g. `["read_file", "write_file"]`). Attempting to use a tool not in this list results in a Hard Failure.
- `declared_permissions`: Array of scopes (e.g. `["fs:read", "fs:write"]`).

### 3. Model Requirements (`model_requirements`) Specifies the AI model capabilities needed.

```json
{
  "tier": "high",
  "context_window": "128k"
}
```

### 4. Logic (`execution_graph`) The serialized orchestration plan. Can be a static graph or a set of prompts for the Planner.

### 5. Integrity (`signature_hash`) A SHA-256 hash of the canonical JSON representation of the pack _excluding_ the `signature_hash` field.

Marketplace packs may require a digital signature from a trusted key.

## Validation Lifecycle 1. **Load**: Parse JSON.

2. **Verify Hash**: Re-compute SHA-256 of content. Compare with `signature_hash`. Fail if mismatch.
3. **Verify Capabilities**: Check against the local `CapabilityRegistry`.
   - Are all `declared_tools` available?
   - Do we have the `declared_permissions`?
4. **Execute**:
   - The `PackExecutor` is initialized with this specific Pack.
   - Any runtime tool call is checked against `declared_tools`.

## Replayability To support deterministic replay:

- The `ExecutionPack` is immutable.
- A `RunID` is generated for the session.
- The `ExecutionContext` includes the `PackID` and `PackVersion`.
- Replaying a run strictly requires the _exact same version_ of the Pack.

## Marketplace Rules Packs distributed via the Marketplace must:

1. Not request `sys:exec` or `sys:admin` permissions unless verified.
2. Be fully self-contained (no external logic references).
3. Have `deterministic` set to `true` if they claim financial or safety-critical outputs.
