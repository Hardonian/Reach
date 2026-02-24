# Remote Validation Threat Model

## Trust assumptions
- Caller trusts validator key distribution (`/public-key`) and operator integrity.

## What it provides
- Signed attestation of verify/replay outcomes for a submitted capsule.

## What it does NOT provide
- No proof that operator is unbiased.
- No confidentiality guarantee beyond transport/runtime controls.
- No proof of model correctness.

## Mitigations
- Signature verification in client.
- Payload size caps and strict JSON decoding.
- Concurrency limits to reduce DoS blast radius.
