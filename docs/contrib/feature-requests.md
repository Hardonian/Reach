# Feature Request Guide

Problem-first feature requests enable faster evaluation and implementation.

---

## Problem-First Template

Describe the problem before proposing solutions.

```markdown
## Problem Statement

<!-- What are you trying to achieve? -->

I need to [goal] because [reason].

Currently, [current behavior/limitation] prevents this.

## Context

<!-- Who is affected and how? -->

- **User type**: [e.g., CI/CD engineer, auditor, plugin developer]
- **Frequency**: [e.g., daily, per release, once per audit]
- **Workaround**: [current workaround if any]

## Desired Outcome

<!-- What does success look like? -->

[Clear description of the end state]

## Proposed Solution (Optional)

<!-- If you have ideas, share them -->

I think we could [approach].

## Alternatives Considered

<!-- What else did you try? -->

- [Alternative 1]: [why it didn't work]
- [Alternative 2]: [why it didn't work]
```

---

## Acceptance Criteria Checklist

Well-specified features include acceptance criteria using the **Given/When/Then** format:

```markdown
### Acceptance Criteria

**Scenario: Basic functionality**

- Given [precondition]
- When [action]
- Then [expected result]

**Scenario: Error handling**

- Given [invalid input]
- When [action]
- Then [specific error with RL-XXXX code]

**Scenario: Edge case**

- Given [edge condition]
- When [action]
- Then [expected behavior]
```

---

## Feature Categories

### CLI Features

Focus on:

- Command naming consistency with existing verbs (`run`, `replay`, `export`)
- JSON output for automation (`--json` flag)
- Exit codes (0=success, non-zero=specific failure)

### Policy/Governance Features

Focus on:

- Backward compatibility with existing policy bundles
- Audit trail completeness
- Performance impact on evaluation

### Plugin System Features

Focus on:

- Determinism guarantees
- Manifest schema versioning
- Capability sandbox boundaries

### Documentation/Examples

Focus on:

- Target audience (beginner, intermediate, advanced)
- Prerequisites and dependencies
- Verification steps

---

## What Makes a Good Feature Request

| Quality       | Good Example                                                                   | Poor Example                |
| ------------- | ------------------------------------------------------------------------------ | --------------------------- |
| **Specific**  | "Add `--since` flag to `reach list`"                                           | "Improve the list command"  |
| **Motivated** | "Our CI generates 1000+ runs daily; filtering by date would reduce query time" | "Would be nice to have"     |
| **Scoped**    | "Support for custom retention policies per pack"                               | "Complete storage overhaul" |
| **Testable**  | "Export should complete in <5 seconds for runs <100MB"                         | "Make exports faster"       |

---

## Prioritization Framework

Features are evaluated on:

1. **Impact** - How many users benefit?
2. **Alignment** - Does it fit Reach's deterministic execution mission?
3. **Complexity** - Implementation and maintenance cost
4. **Alternatives** - Can existing features achieve the goal?

---

## Feature Request Lifecycle

```
Submitted → Triage → Accepted/Declined → Design → Implementation → Release
   ↓           ↓            ↓               ↓          ↓            ↓
  Open    Labeling    Update status    Spec PR     Draft PR    Changelog
```

**Status labels:**

- `needs-triage` - Awaiting initial review
- `accepted` - Approved for implementation
- `design-needed` - Needs specification before coding
- `help-wanted` - Community contributions welcome
- `declined` - Not aligned with project goals (with explanation)

---

## Related Resources

- [Roadmap](../internal/ROADMAP_KILO_DETERMINISTIC_CI_GOVERNANCE.md) - Current priorities
- [Architecture Decisions](../decisions.md) - Historical design decisions
- [Contributing Guide](../../CONTRIBUTING.md) - Implementation guidelines
