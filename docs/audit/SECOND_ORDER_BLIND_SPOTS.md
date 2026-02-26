# Second-Order Blind Spots (Post-Remediation)

## Category H — Complexity inflation
- **Description:** Remediation added controls, docs, and surfaces faster than interaction simplification.
- **Root cause:** Solved trust gaps by additive layering instead of path compression.
- **Persona affected:** Platform Engineer, ML Engineer, OSS Maintainer.
- **Impact severity:** 5
- **Minimal fix:** Define one canonical "default path" and demote all advanced paths to explicitly optional.

## Category I — Narrative dilution
- **Description:** Determinism story now competes with governance/compliance superstructure.
- **Root cause:** Messaging expanded from core value to adjacent value domains without narrative hierarchy.
- **Persona affected:** CTO/VP Eng, Engineering Manager, ML Engineer.
- **Impact severity:** 4
- **Minimal fix:** Enforce a narrative stack: determinism first, governance as consequence, compliance as output.

## Category J — Maintenance burden risk
- **Description:** Breadth across Go/Rust/TS + broad docs and route footprint increases synchronization overhead.
- **Root cause:** Feature accretion across parallel surfaces with partial overlap.
- **Persona affected:** OSS Maintainer, Platform Engineer.
- **Impact severity:** 4
- **Minimal fix:** Freeze net-new surfaces; consolidate duplicate intent surfaces before adding capabilities.

## Category K — OSS contributor friction
- **Description:** Contributor pathway feels gated by high context requirements and extensive quality controls.
- **Root cause:** Enterprise-grade rigor applied universally without contributor lane optimization.
- **Persona affected:** OSS Maintainer.
- **Impact severity:** 4
- **Minimal fix:** Publish "minimum contributor path" with reduced conceptual prerequisites and high-velocity local loop.

## Category L — Performance regression risk
- **Description:** Additional instrumentation and governance checks can quietly increase latency in critical loops.
- **Root cause:** Instrumentation added as default rather than adaptive/level-based in all contexts.
- **Persona affected:** DevOps/SRE, ML Engineer.
- **Impact severity:** 3
- **Minimal fix:** Introduce deterministic but tiered observability modes (default lean, deep trace opt-in).

## Category M — Too Enterprise Too Early
- **Description:** Product can be perceived as procurement-first before developer love is locked in.
- **Root cause:** Compliance and assurance language dominates early surfaces.
- **Persona affected:** ML Engineer, startup Platform Engineer.
- **Impact severity:** 5
- **Minimal fix:** Re-sequence first-contact UX around developer success artifact, not governance artifact.

## Category N — Onboarding overload
- **Description:** New users must internalize too many concepts before seeing concrete value.
- **Root cause:** Multiple valid entry points without enforced progressive disclosure.
- **Persona affected:** Engineering Manager, Platform Engineer, ML Engineer.
- **Impact severity:** 5
- **Minimal fix:** Hard-prune onboarding to three steps with one observable win metric.

## Category O — Trust paradox (too much security signaling)
- **Description:** Heavy security signaling can imply hidden fragility or high operating cost.
- **Root cause:** Security narrative frequency exceeds practical workflow framing.
- **Persona affected:** CTO/VP Eng, Procurement/Legal, Engineering Manager.
- **Impact severity:** 3
- **Minimal fix:** Pair each security claim with explicit user workflow acceleration outcome.

---

## Highest-priority second-order risks
1. **H + N coupling:** complexity inflation and onboarding overload together create silent non-adoption.
2. **I + M coupling:** narrative dilution and enterprise-first tone erode developer pull.
3. **J + K coupling:** maintenance weight can reduce contributor throughput and ecosystem momentum.

## Strict recommendation
Stop adding outward-facing features until onboarding compression and narrative recentering are complete.
