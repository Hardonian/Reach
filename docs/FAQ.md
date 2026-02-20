# FAQ ## How do I check federation trust status?
Run `reachctl federation status`.

## Why was delegation rejected? Common causes are spec mismatch, registry snapshot mismatch, policy mismatch, or a quarantined node.

## Can I bypass policy gate for urgent runs? No. Reach enforces policy gate, signing verification, and replay safety.

## How do I verify a deterministic archive? Use:
- `reachctl capsule verify <file>`
- `reachctl proof verify <runId|capsule>`

## Where can I find support bot behavior? See `docs/SUPPORT_BOT.md` and `support/kb_index.json`.
