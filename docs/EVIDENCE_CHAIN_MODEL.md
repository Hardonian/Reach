# Evidence Chain Model

The Evidence Chain is a cryptographically linked sequence of execution artifacts that together prove the integrity and determinism of a Reach run.

## Timeline View

A run is visualized as a four-stage pipeline:

1. **Input**: The raw data and context provided to the execution. Represented by `InputHash`.
2. **Policy**: The governing rules and constraints. Represented by `PolicyVersion` and `Signature`.
3. **Artifacts**: The environment state, including pack dependencies and tool snapshots. Represented by `RegistrySnapshotHash`.
4. **Output**: The final result and event log. Represented by `OutputHash` (Run Fingerprint).

## Integrity Properties

- **Immutable Linkage**: Each stage's output is an input to the next stage's hash.
- **Deterministic Replay**: Given the exact same Input, Policy, and Artifacts, the Output stage MUST produce the same hash.
- **Auditability**: Any party can re-calculate the hashes from the provided evidence to verify the run.

## Visualization

The `reach playground export` and `reach graph export` commands provide read-only visualizations of this chain, allowing operators to quickly verify the provenance of an execution.
