# Reach System Architecture

## Overview

Reach is a deterministic execution fabric designed for agentic workflows. It follows a layered approach to ensure separation of concerns between presentation, orchestration, and core deterministic computation.

### System Diagram

```text
┌────────────────────────────────┐
│   Interface Layer (CLI/App)    │
│  (reachctl, arcade, extensions)│
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│      Orchestration Layer       │
│  (Workflow, Policy, Registry)  │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│    Deterministic Core Layer    │
│   (Rust Core, Evidence Chain)  │
└────────────────────────────────┘
```

## Component Breakdown

1.  **Runner (`services/runner`)**:
    - The primary service responsible for job queueing, runtime execution, and capability firewalls.
    - Maintains the boundary between non-deterministic triggers and deterministic execution.

2.  **Core Decision Engine (`src/core`)**:
    - Implements the decision logic and transcript generation.
    - Provides both a high-performance Rust implementation (via WASM) and a TypeScript fallback for maximum compatibility.

3.  **Policy Engine (`services/policy-engine`)**:
    - Enforces governance and safety constraints on every execution.
    - Ensures that only authorized operations with verified provenance are permitted.

4.  **Provenance & Evidence Chain (`protocol/`)**:
    - Defines the schemas and cryptographic protocols for evidence linking.
    - Guarantees that every execution has an immutable and verifiable audit trail.

## Data Flow

1.  **Trigger**: A manual CLI command or a webhook triggers a workflow.
2.  **Context Assembly**: Reach gathers all required evidence from the workspace and external sources.
3.  **Policy Check**: The Policy Engine verifies if the execution is allowed under current governance.
4.  **Execution**: The Decision Engine computes the outcome and generates a transcript.
5.  **Finalization**: The transcript is hashed, signed, and stored in the Evidence Chain.

## Trust Boundaries

- **Runner** owns runtime execution and capability firewalls.
- **Policy** owns allow/deny decisions based on signed provenance.
- **Client Interfaces** (Arcade, CLI) are presentation-only and cannot contain domain logic or secrets.
