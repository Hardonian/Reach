# Decisions: The Core Primitive of Reach

In Reach, a **Decision** is not just an outcome—it is a first-class, verifiable artifact with a lifecycle, provenance, and health.

## The Anatomy of a Decision

Every decision in Reach consists of several key components:

1.  **Specification (Spec)**: The formal constraints, goals, and available actions.
2.  **Evidence**: The inputs, observations, and facts asserted by users or automated agents.
3.  **Transcript**: The deterministic record of the reasoning process and computed outcome.
4.  **Health**: A composite score representing completeness, compliance, stability, and risk.

## Decision Lifecycle

1.  **Proposed**: The decision workspace is created and evidence gathering begins.
2.  **Challenged**: Assumptions are questioned, or new evidence suggests a different path.
3.  **Amended**: The spec or evidence is updated to reflect new information.
4.  **Finalized**: The decision is signed and committed to the evidence chain.

## Decision Types

Reach supports several standardized decision types, each with its own required evidence and policy gates:

- **ENG (Engineering)**: Architectural choices, dependency updates, and technical debt.
- **SEC (Security)**: Threat models, control verifications, and vulnerability remediations.
- **OPS (Operations)**: Infrastructure migrations, scaling decisions, and incident responses.
- **PROD (Product)**: Feature launches, roadmap pivots, and customer impact assessments.

## Health Metrics

The health of a decision is tracked via four primary metrics:

- **Evidence Completeness**: Have all required evidence types for the specific decision type been provided?
- **Policy Compliance**: Does the decision adhere to the defined governance and security constraints?
- **Replay Stability**: Does replaying the decision reasoning produce the exact same outcome every time?
- **Assumption Volatility**: How sensitive is the outcome to changes in the underlying facts or assumptions?

## Replay Stability & Fingerprinting

Reach uses a custom fingerprinting algorithm to ensure that identical decision environments always produce the exact same transcript hash. This provides:

- **Auditability**: Third parties can verify reasoning without access to the original secret environment.
- **Regression Testing**: CI gates catch changes that silently alter decision reasoning or outcomes.
- **Federation**: Multiple nodes can arrive at a consensus on the "correct" outcome based on shared evidence.
