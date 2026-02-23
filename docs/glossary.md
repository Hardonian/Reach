# Reach Glossary

Canonical terminology for Reach to ensure consistent communication across CLI, documentation, and discussions.

---

## Canonical Terms

### Policy

A set of rules governing what actions are permitted during execution. Policies are evaluated before and during runs to enforce constraints.

**Usage examples:**
- "The `strict-default` Policy blocks unapproved tools."
- "Apply a cost-limit Policy to prevent runaway spending."
- CLI: `./reach presets apply strict-safe-mode`

---

### Task

A discrete unit of work within an execution. Tasks have inputs, outputs, and deterministic behavior.

**Usage examples:**
- "Each Task in the pack completed within 100ms."
- "The `analyze-code` Task produced a vulnerability report."
- CLI: `./reach run my-pack --input '{"task": "scan"}'`

---

### Transcript

The complete, ordered log of events from a run. The Transcript enables replay and verification.

**Usage examples:**
- "Export the Transcript for audit purposes."
- "Replay verification compares Transcripts bit-for-bit."
- CLI: `./reach logs <run-id>` displays the Transcript

---

### Event

A single entry in a Transcript. Events are timestamped, typed, and cryptographically chained.

**Usage examples:**
- "The `tool.invoked` Event recorded the function call."
- "Event #42 in the Transcript shows the divergence."
- CLI: `./reach replay <run-id> --verbose` shows per-Event details

---

## Avoid These Terms

Use the canonical terms above instead of these legacy/incorrect terms:

| Avoid | Use Instead | Reason |
|-------|-------------|--------|
| "Run" (as a noun for the artifact) | **Transcript** or **Capsule** | "Run" describes the action; Transcript is the artifact |
| "Decision" | **Task** or **Output** | Decisions are one type of Task output |
| "Workflow" | **Pack** | Packs are the executable unit |
| "Log" | **Transcript** | Transcript implies ordering and integrity guarantees |
| "Record" | **Event** | Event is the precise term for Transcript entries |
| "Chain" | **Transcript** or **Evidence chain** | Too vague; be specific |

---

## Correct Usage Examples

### CLI Commands

```bash
# Correct
./reach run security-scan
./reach replay sha256:abc123
./reach export sha256:abc123

# Incorrect
./reach execute security-scan      # "execute" not a command
./reach rerun sha256:abc123        # "rerun" not a command; use "replay"
```

### Documentation

```markdown
# Correct
The Policy engine evaluates rules before each Task invocation.
The Transcript contains Events in chronological order.

# Incorrect  
The policy engine evaluates rules before each task invocation.    # lowercase
The transcript contains events in chronological order.            # lowercase
The workflow generates a log of decisions.                        # legacy terms
```

### Code Comments

```go
// Correct
// Event represents a single entry in a Transcript.
type Event struct {
    Timestamp int64  // Unix nanoseconds
    Type      string // Event type (e.g., "tool.invoked")
}

// Incorrect
// event represents a single log entry.   # lowercase, vague
```

---

## Term Relationships

```
Pack (executable)
  └── Execution
       ├── Policy (governance rules)
       ├── Task(s) (work units)
       │     └── Output(s)
       └── Transcript (event log)
             └── Event(s) (individual entries)
                   └── Fingerprint (hash)
```

---

## Context-Specific Usage

### When Discussing Governance

Use **Policy** as the primary term. Avoid "rules" or "constraints" without specifying they are part of a Policy.

### When Discussing Replay/Verification

Use **Transcript** and **Event**. The Transcript is what makes replay possible.

### When Discussing Execution

Use **Task** for units of work, **Pack** for the container, and **Event** for what gets recorded.

### When Discussing Storage

Use **Capsule** for the portable bundle format, **Transcript** for the event log within it.

---

## See Also

- [CLI Reference](./cli.md) - Command descriptions
- [Architecture](./architecture.md) - System components
- [Internal: Event Model](./internal/EVENT_MODEL.md) - Event specifications
- [Internal: Policy Engine Spec](./internal/POLICY_ENGINE_SPEC.md) - Policy internals
