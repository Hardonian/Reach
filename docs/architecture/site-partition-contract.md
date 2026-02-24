# Site Partition Contract: reach-cli.com (OSS) vs ready-layer.com (Enterprise Stub)

## Purpose

This contract defines permanent governance rules for serving two public hosts from one codebase:

- **reach-cli.com** → Reach OSS product and documentation.
- **ready-layer.com** → ReadyLayer enterprise roadmap/beta stub.

All CI checks, scripts, and metadata generation must enforce these rules.

## Scope Boundaries

### OSS host (`reach-cli.com`)

Allowed scope:

- OSS product marketing and documentation.
- Download/install instructions.
- Security posture and OSS roadmap.
- Links to enterprise host only as roadmap/beta references.

Forbidden scope:

- Claims that enterprise-only controls are generally available in OSS.
- Managed service SLA promises.
- Production-ready enterprise control plane claims.

### Enterprise host (`ready-layer.com`)

Allowed scope:

- Roadmap/beta positioning for enterprise governance capabilities.
- Contact and pilot-planning funnel.
- Explicit references to Reach OSS as the available foundation.

Forbidden scope:

- Presenting roadmap capabilities as shipped GA unless explicitly labeled.
- Download/install UX that implies enterprise software is self-serve available today.

## Allowed Cross-links

- OSS → Enterprise: `/enterprise`, `/contact`, and `https://ready-layer.com/*` roadmap/contact pages.
- Enterprise → OSS: `https://reach-cli.com`, `https://reach-cli.com/docs`, and OSS download/docs pages.
- Cross-links must preserve host identity and must not claim feature parity.

## Claims and Terminology Guardrails

### Enterprise-only terms blocked on OSS pages

Examples (case-insensitive):

- `SLA`
- `SOC 2`
- `SSO`
- `SCIM`
- `managed control plane`
- `tenant isolation dashboard`
- `enterprise support contract`

Allowed only on OSS when clearly marked as enterprise roadmap/beta context.

### Unshipped enterprise features

On enterprise pages, claims that mention planned capabilities must include one of:

- `Roadmap`
- `Stub`
- `Beta`
- `Planned`
- `Not yet available`

## Shared Content and Import Rules

- Site-specific code must remain isolated.
- Shared code is limited to neutral primitives and shared content packages.
- Cross-site imports are forbidden except through:
  - `packages/ui`
  - `packages/content`

## SEO and Host Correctness Rules

- Canonical URLs must always resolve to the active host.
- `reach-cli.com` pages must canonicalize and emit OG URLs on `https://reach-cli.com`.
- `ready-layer.com` pages must canonicalize and emit OG URLs on `https://ready-layer.com`.
- Sitemap generation must be mode-specific and must not leak routes intended for the other host.
- `robots.txt` must reference the sitemap URL for the active host only.

## Enterprise Stub Labeling Rules

When `SITE_MODE=enterprise` or host resolves to `ready-layer.com`:

- Enterprise pages must visibly communicate roadmap/beta/stub status.
- Any forward-looking feature claim must be labeled with roadmap/stub language.
- Contact CTA should focus on pilot/advisory/beta onboarding, not GA purchase flow.

## Enforcement

CI and local verify commands must include:

- claims lint (`validate:site-claims`)
- import boundary lint (`validate:site-boundaries`)
- mode-aware link integrity check
- build/test matrix for OSS and enterprise modes
