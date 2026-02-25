# Reach Glossary

Canonical terminology for Reach to ensure consistent communication across CLI, documentation, and marketing.

---

## The Landscape

### Reach (OSS)

The open-source, local-first deterministic engine and CLI. It is designed for individual researchers and developers building autonomous agents.

### ReadyLayer (Cloud/Enterprise)

The commercial platform built on top of Reach. It provides multi-tenant orchestration, centralized reporting, "Drift Guard" alerting, and enterprise governance (SOC2, Agent Contracts).

---

## Core Concepts

### Policy

A set of rules governing what actions are permitted during execution. Policies are evaluated before and during runs to enforce constraints.

**Usage examples:**

- "The `strict-default` Policy blocks unapproved tools."
- "Apply a cost-limit Policy to prevent runaway spending."

---

### Task

A discrete unit of work within an execution. Tasks have inputs, outputs, and deterministic behavior.

**Usage examples:**

- "Each Task in the Pack completed within 100ms."
- "The `analyze-code` Task produced a vulnerability report."

---

### Transcript

The complete, ordered log of events from a run. The Transcript enables replay and verification by capturing every side effect and decision.

---

### Capsule

A portable, cryptographically signed bundle containing the Transcript, associated metadata, it is the fundamental unit of evidence in Reach.

---

### Event

A single entry in a Transcript. Events are timestamped, typed, and cryptographically chained.

---

### Deterministic Replay

The ability to re-run a Task or Pack using a Transcript and produce the exact same bit-for-bit output.

---

### Evidence Chain

The cryptographic linkage between Inputs, Policies, Tasks, and Outputs that allows any result to be mathematically verified.

---

## Avoid These Terms

Use the canonical terms above instead of these legacy/incorrect terms:

| Avoid                              | Use Instead                   | Reason                                               |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------- |
| "Run" (as a noun for the artifact) | **Transcript** or **Capsule** | "Run" describes the action; Capsule is the bundle    |
| "Decision"                         | **Task** or **Output**        | Decisions are one type of Task output                |
| "Workflow"                         | **Pack**                      | Packs are the executable unit                        |
| "Log"                              | **Transcript**                | Transcript implies ordering and integrity guarantees |
| "Record"                           | **Event**                     | Event is the precise term for Transcript entries     |
| "Chain"                            | **Evidence chain**            | Too vague; be specific                               |
| "Plugin" (usually)                 | **Skill Pack**                | Reach uses Skill Packs for modularity                |

---

## Correct Usage Examples

### CLI Binaries

- `reach`: The local developer wrapper/CLI.
- `reachctl`: The core controller (usually called via the `reach` wrapper).

### Documentation

```markdown
# Correct

The Policy engine evaluates rules before each Task invocation.
The Transcript contains Events in chronological order.
The Capsule was verified successfully.

# Incorrect

The policy engine evaluates rules before each task invocation. # lowercase
The workflow generates a log of decisions. # legacy terms
The artifact was uploaded. # use "Capsule"
```

---

## Term Relationships

```text
Reach (OSS) / ReadyLayer (Cloud)
  └── Pack (executable)
        └── Execution
             ├── Policy (governance rules)
             ├── Task(s) (work units)
             │     └── Output(s)
             └── Transcript (event log)
                   └── Event(s) (individual entries)
                         └── Capsule (signed artifact)
```

---

## See Also

- [CLI Reference](./cli.md) - Command descriptions
- [Architecture](./architecture.md) - System components
- [Stability](./stability.md) - Versioning and roadmap
- [Internal: Event Model](./internal/EVENT_MODEL.md) - Event specifications
