# Deterministic LLM Memory Hashing

`reach memory hash` canonicalizes memory items and emits a SHA-256 hash anchor.

- No model calls are made.
- Raw memory content can remain local/private.
- Hash anchors can be attached to transcripts for replay-time consistency checks.

This proves input-memory consistency, not output correctness.
