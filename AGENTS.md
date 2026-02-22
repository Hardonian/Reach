# Reach – AGENTS.md

Last Updated: 2026-02-18

## Purpose

Defines autonomous agent roles, responsibilities, and constraints for **Reach**.

## Global Principles

- Production-grade output only (no placeholders)
- Deterministic file changes; prefer minimal diffs
- Never delete content unless directly conflicting with newer validated structure
- Optimize for clarity, minimal context usage, and high leverage
- User routes must never hard-500 (graceful degradation)

## Agent Roles

- **Architecture Agent:** system design, invariants, boundaries, modular cohesion
- **Code Quality Agent:** lint/typecheck/build, hydration/perf passes, vulnerability hygiene
- **Design Agent:** visual system integrity, tokens, UI coherence, hero/motion alignment
- **Infrastructure Agent:** CI/resilience, env validation, security hardening, deploy readiness
- **Release Agent:** changelog discipline, versioning, smoke verification, rollback notes
- **Documentation Agent:** README/CHANGELOG/ADR updates, eliminates redundancy

## Deterministic CI Principles for Agents

Agents contributing to Reach must adhere to the following deterministic guardrails:

1. **Entropy Reduction**: Every change must either maintain or reduce the system's total entropy. Avoid introducing non-deterministic logic, unstable timestamps, or unordered maps in core paths.
2. **Boundary Enforcement**: Respect the [Import Boundaries](docs/IMPORT_RULES.md). Never leak cloud-specific dependencies into the OSS core.
3. **Drift Detection**: Before submitting a PR, verify determinism using `reach verify-determinism`. Mismatched hashes are blocked by the `verify:full` gate.
4. **Evidence-First**: All new execution features must include a corresponding update to the Evidence Chain model.

## Reach Glossary

- **Run**: A single execution of a pack with specific inputs.
- **Determinism**: The property where identical inputs, policies, and artifacts ALWAYS produce identical output hashes.
- **Replay**: The process of re-executing a Run from its event log to verify its fingerprint.
- **Gate**: A policy evaluation point that can allow or deny execution.
- **Artifact**: A versioned dependency or environment state used during a Run.
- **Policy**: A set of rules (e.g., Rego) that governs execution behavior.
- **Fingerprint**: The derived SHA256 hash of a Run's event log and ID.
- **Capsule**: A signed, portable bundle containing a Run's manifest and event log.

## Injection Protocol

When new constraints/skills are added:

1) Append new capability or rule.
2) Refine for clarity and remove duplication.
3) Preserve prior decisions unless superseded by verified improvements.
