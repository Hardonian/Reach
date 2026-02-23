# Release Super-Gate Use `reach release-check` before cutting any release.

## What it runs 1. `reach doctor`

2. Unit tests (packkit + connector-registry + runner + engine-core)
3. E2E smoke (`tools/e2e-smoke.sh`): install-intent/install/uninstall + policy deny negative test
4. Static checks:
   - protocol schema parse validation
   - golden fixture parsing tests for registry index variants

## Security guardrails in release-check path - Signature and SHA verification remain mandatory in non-dev mode.

- Remote registries are HTTPS-only by default.
- SSRF hardening blocks private/link-local/multicast hosts unless `DEV_ALLOW_PRIVATE_REGISTRY=1`.
- Redirects are bounded and cross-scheme redirects are rejected.
- Payload size and HTTP timeouts are enforced.

## CI `ci.yml` runs `./reach release-check` in `hardening-gates` on pull requests.
