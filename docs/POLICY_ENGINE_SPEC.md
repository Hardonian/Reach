# Policy Engine Specification — Reach V1

Last Updated: 2026-02-22

## Purpose

The Policy Engine defines how Reach evaluates rules that govern execution behavior. It is a pure, deterministic evaluation function: given the same policy bundle and execution context, it must always produce the same verdict.

---

## Policy Schema

A policy is a bundle of named rules. Each rule has:

```json
{
  "version": "1.0.0",
  "name": "strict-default",
  "description": "Default policy enforcing capability boundaries.",
  "rules": [
    {
      "id": "capability-check",
      "name": "Capability Allowlist",
      "severity": "DENY",
      "condition": "tool NOT IN allowed_tools",
      "suggestion": "Add the tool to the capability allowlist in your pack manifest.",
      "deterministic": true,
      "evaluation_order": 1
    },
    {
      "id": "replay-integrity",
      "name": "Replay Integrity Check",
      "severity": "DENY",
      "condition": "replay_fingerprint != original_fingerprint",
      "suggestion": "Re-run the original pack and compare with 'reachctl diff-run'.",
      "deterministic": true,
      "evaluation_order": 2
    },
    {
      "id": "timeout-guard",
      "name": "Execution Timeout Guard",
      "severity": "WARN",
      "condition": "execution_duration_ms > timeout_limit_ms",
      "suggestion": "Increase the timeout in your pack manifest or optimize the tool call.",
      "deterministic": false,
      "evaluation_order": 3
    }
  ]
}
```

### Field Definitions

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `version` | semver | Yes | Policy schema version. Must match the engine's expected schema version. |
| `name` | string | Yes | Human-readable policy name. |
| `rules` | Rule[] | Yes | Ordered array of policy rules. Evaluation follows `evaluation_order`. |
| `rule.id` | string | Yes | Stable machine-readable identifier. Never change once published. |
| `rule.severity` | `DENY \| WARN \| INFO` | Yes | `DENY` blocks execution. `WARN` logs but continues. `INFO` is informational only. |
| `rule.condition` | string | Yes | Predicate expression. Must be deterministic given the same context. |
| `rule.suggestion` | string | Yes | Human-readable fix guidance surfaced by `reachctl explain-failure`. |
| `rule.deterministic` | boolean | Yes | If `true`, the same inputs MUST produce the same verdict. Non-deterministic rules (e.g., timeouts) are `false`. |
| `rule.evaluation_order` | integer | Yes | Stable evaluation order. Lower numbers evaluate first. Must be unique within a policy. |

---

## Evaluation Model

### Evaluation Function

```
evaluate(policy: Policy, context: ExecutionContext) → Verdict
```

Where `Verdict` is one of:
- `ALLOW` — All DENY rules passed. Execution may proceed.
- `DENY(rule_id, message)` — At least one DENY rule failed.

### Evaluation Order

Rules are evaluated in strictly ascending `evaluation_order`. The first `DENY` result terminates evaluation and returns immediately. This is deterministic because:

1. The rule set is fixed at policy bundle version commit time.
2. `evaluation_order` values are unique and stable.
3. The evaluation function is pure (no side effects, no I/O).

### Context Fields

The `ExecutionContext` passed to each rule includes:

```json
{
  "run_id":           "...",
  "pack_id":          "...",
  "tools_requested":  ["tool-a", "tool-b"],
  "allowed_tools":    ["tool-a"],
  "replay_mode":      false,
  "execution_duration_ms": 0,
  "timeout_limit_ms": 30000,
  "input_hash":       "sha256:..."
}
```

---

## Gate Evaluation — Determinism Requirements

Gates (checkpoints in execution where policy is re-evaluated) must be:

1. **Pure**: No I/O, no time.Now(), no randomness.
2. **Stable-ordered**: Multiple rules evaluated in order, not in parallel.
3. **Version-locked**: Gate evaluation uses the policy version pinned to the run.

### Gate Types

| Gate | When It Fires | Default Policy |
| :--- | :--- | :--- |
| `pre-execution` | Before any step executes | Evaluate all DENY rules |
| `tool-call` | Before each tool is invoked | Check capability allowlist |
| `post-execution` | After all steps complete | Evaluate replay integrity |
| `replay` | During replay verification | Check fingerprint match |

---

## Explain-Failure Surface

For every `DENY` verdict, Reach produces a structured explanation:

```bash
reachctl explain-failure <run-id>
```

Output (JSON):
```json
{
  "run_id": "abc123",
  "status": "DENIED",
  "denied_by": {
    "rule_id": "capability-check",
    "rule_name": "Capability Allowlist",
    "severity": "DENY",
    "message": "tool 'disallowed-tool' is not in the capability allowlist",
    "suggestion": "Add the tool to the capability allowlist in your pack manifest.",
    "deterministic": true
  },
  "evaluation_order_reached": 1,
  "total_rules_evaluated": 1
}
```

---

## Policy Validation

Policy bundles are validated at load time against the JSON Schema at [`protocol/schemas/policy-bundle.schema.json`](../protocol/schemas/policy-bundle.schema.json).

```bash
# Validate a policy bundle
reachctl validate-policy path/to/policy.json
```

---

## Policy Versioning

- Policy bundles are content-addressed: `policy_version = SHA-256(bundle_json)`.
- Once a policy is used in a run, its bundle is stored in `~/.reach/runs/<run_id>/artifacts/policy.json`.
- Changing a policy produces a different `policy_version`, which changes the `run_id` for future identical inputs.

---

## OSS Default Policy

The OSS default policy (`policies/policy.strict-default/manifest.json`) enforces:
1. Capability allowlist checking.
2. No disallowed tool calls.
3. Replay integrity verification on `replay` gate.

---

## Related Documents

- [`docs/DETERMINISM_SPEC.md`](DETERMINISM_SPEC.md) — How policies are part of the fingerprint
- [`docs/ERROR_CODE_REGISTRY.md`](ERROR_CODE_REGISTRY.md) — RL-1xxx policy error codes
- [`docs/CLI_REFERENCE.md`](CLI_REFERENCE.md) — `reachctl explain-failure` command
- [`protocol/schemas/policy-bundle.schema.json`](../protocol/schemas/policy-bundle.schema.json) — Policy bundle JSON Schema
