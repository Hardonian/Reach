# reach doctor `reach doctor` is the single authoritative health command for trust + hardening checks.

## Run ```bash

./reach doctor

```

## What it validates - Registry source configuration wiring.
- Index schema parsing and cache guardrails (TTL + size bounds).
- Signature verification path presence.
- Policy/runner routing configuration presence.
- Runner capability firewall markers.
- Marketplace consent gates (idempotency key, accepted capabilities, risk acknowledgment).
- Architecture boundary constraints.

## Output contract - Stable concise lines:
  - `[OK] <check>`
  - `[FAIL] <check>` with a short remediation line.
- Non-zero exit when any check fails.
```
