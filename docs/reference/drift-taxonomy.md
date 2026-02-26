# Drift Taxonomy

Reach classifies semantic drift into deterministic categories:
- `ModelDrift`
- `PromptDrift`
- `ContextDrift`
- `PolicyDrift`
- `EvalDrift`
- `RuntimeDrift`
- `UnknownDrift`

Classification compares before/after semantic descriptors and emits human-readable change vectors.
`UnknownDrift` is reserved for fingerprint mismatch with no descriptor field changes.
