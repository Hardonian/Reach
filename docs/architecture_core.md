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
    *   The primary service responsible for job queueing, runtime execution, and capability firewalls.
    *   Maintains the boundary between non-deterministic triggers and deterministic execution.

2.  **Core Decision Engine (`src/core`)**:
    *   Implements the decision logic and transcript generation.
    *   Provides both a high-performance Rust implementation (via WASM) and a TypeScript fallback for maximum compatibility.

3.  **Policy Engine (`services/policy-engine`)**:
    *   Enforces governance and safety constraints on every execution.
    *   Ensures that only authorized operations with verified provenance are permitted.

4.  **Provenance & Evidence Chain (`protocol/`)**:
    *   Defines the schemas and cryptographic protocols for evidence linking.
    *   Guarantees that every execution has an immutable and verifiable audit trail.
