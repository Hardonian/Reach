# Reach Protocol Specification Changelog All notable changes to the Reach Protocol Specification will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-18 ### Added

- Initial formal protocol specification
- Execution model with defined lifecycle states and transitions
- Event ordering guarantees
- Deterministic hash computation rules
- Replay guarantees and requirements
- Policy enforcement model with capability declarations
- Pack structure specification with required fields
- Federation semantics including node identity and delegation
- Error model with categorized error codes
- Artifact guarantees for time capsules and proofs
- Versioning policy with backward compatibility guarantees

### Specification Details #### Execution Model

- Defined 6 run states: PENDING, PREPARING, EXECUTING, COMPLETED, FAILED, ABORTED
- Specified state transition matrix with MUST-level guarantees
- Defined event ordering requirements
- Specified SHA-256 based hash computation

#### Policy Enforcement - Capability declaration requirements

- Tool allowlist enforcement semantics
- Denial behavior with structured error requirements

#### Pack Structure - Required fields: specVersion, id, version, manifest, entrypoint

- specVersion format: SemVer 2.0.0
- Manifest schema for capabilities and metadata
- Ed25519 signing requirements

#### Federation - Node identity model with UUID v4 and Ed25519 keys

- Delegation contract specification
- Trust boundary rules

#### Error Model - Namespaced error codes: PROTO*, POLICY*, EXEC*, FED*, PACK\_

- Hard vs soft failure classification
- Structured error response format

#### Artifacts - Time capsule format (TAR.gz)

- Deterministic export requirements
- Proof model for cryptographic verification

---

## Version Policy ### Major Versions (X.0.0)

- Breaking changes to protocol semantics
- New required fields in core structures
- Changes to hash computation
- Migration tools provided

### Minor Versions (x.Y.0) - New optional features

- Additional error codes
- Extended schemas (backward compatible)
- Deprecated features marked

### Patch Versions (x.y.Z) - Specification clarifications

- Documentation fixes
- No behavioral changes

---

## Migration Guide ### Upgrading to 1.0.0

This is the initial specification release. No migration required.

Future migrations will include:

- Schema transformation tools
- Compatibility adapters
- Deprecation warnings
