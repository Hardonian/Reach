# Reach Execution Protocol

## 1. Overview

This document defines the **Execution Envelope** for Reach. It formally separates the roles of **Planner**, **Executor**, and **Coordinator** to ensure deterministic, safe, and auditable execution of agentic tasks.

## 2. Roles

### 2.1 Planner

- **Responsibility**: Generates a structured execution plan based on an objective and context.
- **Input**: Session Context (JSON), Objective (String).
- **Output**: `OrchestrationBlueprint` (Strict JSON).
- **Constraints**:
  - Pure function (deterministic given same input/seed).
  - No side effects.
  - No tool execution.
  - Cannot modify session state directly.

### 2.2 Executor

- **Responsibility**: Executes a single atomic task (Tool Call) within the envelope.
- **Input**: `ExecutionEnvelope` (containing Tool Name, Arguments, Context).
- **Output**: `ExecutionResult` (Success/Failure, Output Data, Artifacts).
- **Constraints**:
  - Sandboxed execution.
  - enforced tool allowlist.
  - No access to global session state (only passed context).
  - Must return explicit errors (no swallowed exceptions).

### 2.3 Coordinator (The Loop)

- **Responsibility**: Manages the session lifecycle, state transitions, and orchestrates the Planner and Executor.
- **Input**: `AutonomousSession`.
- **State**: Maintains the `SessionState` (Iteration count, Budget, History).
- **Constraints**:
  - Validates all transitions.
  - Enforces policy/budget.
  - Handles interrupts/signals.

## 3. Data Structures

### 3.1 Execution Envelope

The `ExecutionEnvelope` is the strict contract for any side-effecting operation.

```json
{
  "id": "env-uuid",
  "task_id": "task-uuid",
  "tool": "tool.name",
  "arguments": { ... },
  "context": {
    "session_id": "session-uuid",
    "permissions": ["perm.read", "perm.write"]
  },
  "timeout_ms": 5000
}
```

### 3.2 Execution Result

```json
{
  "envelope_id": "env-uuid",
  "status": "success" | "failure" | "error",
  "output": { ... },
  "error": {
    "code": "ERR_CODE",
    "message": "Human readable"
  },
  "metrics": {
    "duration_ms": 120
  }
}
```

## 4. Execution Flow

1. **Coordinator** receives request -> Spawns Session.
2. **Coordinator** calls **Planner** -> Gets `OrchestrationBlueprint`.
3. **Coordinator** validates Blueprint (Budget, Policy).
4. **Coordinator** iterates through Blueprint Phases:
   a. **Coordinator** constructs `ExecutionEnvelope` for next step.
   b. **Coordinator** passes Envelope to **Executor**.
   c. **Executor** runs tool -> Returns `ExecutionResult`.
   d. **Coordinator** updates Session State.
   e. **Coordinator** checks stop conditions.

## 5. Security & Isolation

- **Marketplace Containment**: Templates run in a restricted Executor instance with limited tool access.
- **Session Isolation**: Each session has a unique execution context throughout. No shared memory between sessions.
- **Deterministic Replay**: Identify sources of non-determinism (Time, Random) and mock/seed them in Replay Mode.

## 6. Error Handling

- **Soft Failures**: Tool errors (e.g., file not found). Planner can recover.
- **Hard Failures**: Protocol violations, Budget exceeded. Session terminates.
- **Panic Recovery**: Executor must catch panics and return a formatted Error result.
