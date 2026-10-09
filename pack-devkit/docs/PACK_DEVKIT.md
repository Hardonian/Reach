# Reach Pack DevKit The Pack DevKit is a comprehensive toolkit for authoring, testing, and publishing Reach Execution Packs with safety and determinism guarantees.

## Overview Execution Packs are portable, verifiable, and immutable containers for agentic workflows. The DevKit ensures:

- **Safe-by-default authoring**: Templates and linting prevent common mistakes
- **Determinism verification**: Replay testing ensures consistent execution
- **Policy compliance**: Contract validation before publishing
- **OSS-first publishing**: PR-based registry contributions, no SaaS required

## Quick Start ```bash

# Create a new governed pack from template reach pack init --template governed-minimal my-pack

# Run conformance tests reach pack test my-pack

# Lint and validate reach pack lint my-pack

# Full health check reach pack doctor my-pack

# Prepare for publishing reach pack publish my-pack --registry https://github.com/reach/registry

````

## DevKit Structure ```
/pack-devkit
  /templates          # Starter templates for pack authors
  /fixtures           # Golden fixtures for conformance testing
  /harness            # Test harness implementation
  /docs               # Documentation
````

## Templates ### governed-minimal

Basic pack with deterministic execution guarantees.

### governed-with-policy Pack with policy contract for access control.

### governed-with-replay-tests Pack with built-in replay verification tests.

### federation-aware Pack metadata for federation (no new federation features).

## Conformance Testing The harness validates:

- Event log shape compliance
- Policy decision recording
- Deterministic run hash stability
- Replay fidelity

## Lint Rules - `spec-version`: Required specVersion pin present and valid

- `policy-contract`: Policy file present and schema-valid
- `capability-match`: Declared capabilities match tool usage
- `signing-metadata`: Signing fields present when required
- `no-non-determinism`: No forbidden patterns (Date.now/Math.random) in core files
- `schema-valid`: File/manifest schema correctness

## Publishing PR-based workflow (no SaaS):

1. Generate registry entry manifest
2. Generate attestation metadata
3. Output PR bundle with instructions
4. Optionally open PR via GitHub CLI

## CI Gates Prevents bad packs from being published:

- Lint must pass
- Tests must pass
- Determinism hash must be stable
- Policy contract must be valid
