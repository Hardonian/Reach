# Reach Stability Contract & Versioning Policy

This document outlines the stability guarantees, versioning policy, and what constitutes a breaking change within the Reach ecosystem. As decision infrastructure, Reach prioritizes backwards compatibility and deterministic execution over rapid feature iteration.

## 1. CLI Command Stability

The Reach CLI operates under a strict stability contract to ensure automation and CI/CD pipelines do not break unexpectedly.

### Stable Commands
The following root `reach` and `reachctl` commands are considered **STABLE**. Their arguments, flags, and standard output formats (especially when using `--json`) will not change in a backwards-incompatible way without a major version bump:
- `doctor`: System health checks.
- `run`: Execution of packs and workflows.
- `eval`: Regression testing against golden fixtures.
- `audit`: Export and verification of logs.
- `capsule`: Creation and validation of execution capsules.
- `proof`: Cryptographic execution proofs (PoEE).
- `gate`: CI/CD gate management.
- `workflow *`: All workflow subcommands (`start`, `add-note`, `run`, `export`, `health`, `graph`).

### Experimental / Beta Commands
The following commands are currently **EXPERIMENTAL** and their interfaces or outputs may change in minor releases:
- `cost`: Unit economics and cost analysis.
- `metrics`: GTM and usage analytics.
- `wizard`: Guided generic run wizard.

## 2. JSON Schemas & Data Structures

Data exchanged with Reach must conform to versioned JSON schemas. Changes to these schemas are subject to our Breaking Change policy (see below).

- **Plugin Schema** (`plugins/plugin-schema.json`): Defines the interface for external execution plugins.
- **Policy Pack Schema** (`policy-packs/schema.json`): Defines the declarative structure of governance packs.
- **Protocol Schemas** (`protocol/**/*.schema.json`): Define the wire format for IDE and Agent communication.

## 3. Fingerprint & Canonicalization Guarantees

Reach guarantees that decision executions are deterministic.
- **Canonicalization**: All JSON outputs and intermediate states are strictly canonicalized (keys sorted, whitespace normalized) before hashing.
- **Fingerprinting**: Each execution generates a deterministic SHA-256 `fingerprint` (e.g., `run_fingerprint`).
- **Guarantee**: Given the same inputs, environment factors, and protocol version, Reach guarantees identical outputs and an identical cryptographic fingerprint. Any change to the engine that alters a fingerprint for historical runs is considered a **CRITICAL BREAKING CHANGE**.

## 4. Breaking Changes & Versioning Policy

Reach strictly adheres to **Semantic Versioning (SemVer) 2.0.0**.

### What constitutes a Breaking Change?
A change is considered breaking (forcing a `MAJOR` version bump) if it:
1. Removes or renames a STABLE CLI command, flag, or environment variable.
2. Modifies the canonical serialization format in a way that alters historical fingerprints.
3. Removes required fields or adds new required fields to a STABLE JSON schema without a fallback.
4. Alters the evaluation logic of the Rust Decision Engine such that identical inputs yield a different decision output.

### Compatibility Guarantees
- **Data Portability**: Execution capsules generated in version `N` will be verifiable in version `N` and `N+1`.
- **API Stability**: Any `--json` CLI output will only append fields in `MINOR` or `PATCH` releases. Existing fields will not be removed or change data types.

---
*Reach: Reducing entropy in autonomous systems.*
