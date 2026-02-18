# Support Bot

## Modes
- Deterministic local retrieval mode from `support/kb_index.json` and docs.
- Optional external enhancement can be layered later; base mode is OSS/self-hosted only.

## Safety constraints
- Refuses any policy bypass/signing bypass/replay bypass instruction.
- Redacts token/key/secret-like strings from user inputs.
- Provides safe troubleshooting next steps and doc pointers only.

## Interface
CLI: `reach support ask "<question>"`.

## References
- `docs/FAQ.md`
- `support/faq.md`

