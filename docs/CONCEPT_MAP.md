# Reach Concept Map

Reach removes unpredictable AI loops by enforcing a structured lifecycle. This diagram illustrates the flow from input to outcome.

```mermaid
graph TD
    subgraph "Input Layer"
        A[External Data/Event] --> B[Fingerprint & Hash]
    end

    subgraph "Governance (Policy Gates)"
        B --> C{Policy Evaluation}
        C -- Deny --> D[Safety Exit]
        C -- Allow --> E[Canonical State]
    end

    subgraph "Deterministic Execution"
        E --> F[Decision Engine]
        F --> G[Replay Tracker]
        G --> H[Evidence Chain]
    end

    subgraph "Verification & Output"
        H --> I[Capsule Creation]
        I --> J[Replay Verification]
        J --> K[Final Output/Action]
    end

    subgraph "Persistence"
        K --> L[Event Store SQLite]
        L --> M[Merkle Audit Root]
    end
```

## Core Flow Explained

1. **CLI/API Entry**: Requests enter via the `reach` CLI or SDK.
2. **Fingerprinting**: Inputs are immediately hashed to ensure a consistent starting point for replay.
3. **Policy Gates**: Decisions pass through a set of immutable rules (budget, safety, ethics) before execution.
4. **Engine Replay**: The Rust-based core engine evaluates branches deterministically. Every "random" seed is logged.
5. **Memory Storage**: Temporary state is managed in-process; final results are committed to the ledger.
6. **Evidence Outputs**: A portable capsule is generated, allowing any third party to re-verify the decision with bit-perfect accuracy.
