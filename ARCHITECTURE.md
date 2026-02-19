# Reach Protocol Architecture

## Overview
Reach is a deterministic execution protocol designed for auditable, high-trust coordination between distributed agents. It transforms a standard task execution queue into a verifiable "Decision Fortress" using economic moats, hardware-level trust, and cryptographic proofs.

## Core Components

### 1. Runner (Agent Gateway)
- **API Server**: Entry point for runs, tool results, and management (Import/Export/Audit).
- **Durable Queue**: Ensures Exactly-Once execution semantics for tool calls.
- **Node Registry**: Manages hardware-attested executors (TPM/TEE) and their reputation scores.

### 2. Moat Systems
- **Economic Moat**: Budget-aware execution prevents runaway costs and spam.
- **Reliability Moat**: ML-enhanced reputation scoring routes critical tasks to high-reliability nodes.
- **Integrity Moat**: Content-addressed execution packs (CIDs) ensure that the code running on a node is exactly what was audited.

### 3. Adaptive Engine
- Dynamic routing of tasks based on constraints (latency vs. determinism).
- Self-healing recovery paths when execution drift is detected.

## Data Flow
1. **Initiation**: A run is created with a `PackCID` and budget.
2. **Scheduling**: The `AdaptiveEngine` determines the best node based on complexity and reputation.
3. **Execution**: The node executes the pack, producing signed events.
4. **Validation**: Tool results are verified against ZK proof capsules.
5. **Auditing**: Every step is recorded in the immutable Decision Ledger, exposed via the Transparency API.

## Security Model
- **Defense in Depth**: Combines network-level authentication, hardware-level attestation, and cryptographic integrity.
- **Deterministic Replay**: All state transitions are captured in the event log, allowing bit-for-bit replay of any run.
- **Isolation**: Workspaces and enclaves prevent cross-tenant leakage.

## Directory Structure
- `/services/runner/internal/api`: HTTP handlers and route registration.
- `/services/runner/internal/jobs`: Core business logic for runs and queues.
- `/services/runner/internal/storage`: Persistent storage (SQLite).
- `/services/runner/internal/federation`: Mesh-level coordination and reputation.
- `/services/runner/internal/pack`: Registry and linting for execution packs.
