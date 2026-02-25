# Incident Response

Lightweight response playbook for OSS and hosted environments.

## 1. Triage

- Confirm scope: affected tenant(s), API surface, and release version.
- Capture correlation IDs and relevant run IDs.
- Freeze risky automation paths when needed (`Emergency Freeze` path).

## 2. Containment

- Revoke impacted API keys and rotate secrets.
- Disable impacted gates/signals/routes if needed.
- Apply temporary strict mode if warning-only paths are unsafe:
  - `READYLAYER_STRICT_MODE=true`

## 3. Eradication

- Patch root cause.
- Re-run:

```bash
npm run verify
npm run verify:conformance
npm run verify:security
npm run verify:vercel
```

## 4. Recovery

- Deploy fixed version.
- Confirm `/api/health` and `/api/ready`.
- Verify no cross-tenant exposure and expected audit events.

## 5. Postmortem

- Record timeline, root cause, and preventive actions.
- Add regression checks/scripts where feasible.
- Update changelog and security posture docs.
