# Semantic State Reference

`SemanticStateId` is the existing deterministic fingerprint exposed as an opaque identifier.

## SemanticPreimageDescriptor
A descriptor that captures governance-relevant inputs:
- prompt template id/version
- model id/version
- policy snapshot id
- context snapshot id
- runtime id
- eval snapshot id (optional)

## SemanticState
A semantic state binds:
- `id` (fingerprint)
- provenance fields (`createdAt`, `actor`, `source`)
- labels and descriptor

This abstraction wraps existing replay/fingerprint behavior without changing hash computation.
