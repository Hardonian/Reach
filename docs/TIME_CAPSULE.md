# Deterministic Time Capsule

Reach time capsules are deterministic JSON archives that include event logs, pack/policy metadata, federation path context, trust snapshots, audit roots, and redacted environment fingerprints.

## Commands
- `reachctl capsule create <runId> [--output file]`
- `reachctl capsule verify <file>`
- `reachctl capsule replay <file>`

Capsules use canonical JSON ordering and a fixed `created_at` timestamp to keep hashes stable across machines.
