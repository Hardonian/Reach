# ReadyLayer Operator Playbook

The canonical guide for Founder-led maintenance and strategic acceleration.

## THE MONDAY 15-MINUTE PULSE

**Goal**: Align technical execution with activation reality.

1. **AUDIT THE FUNNEL (0-5m)**:
   - Check `MTTFS` (Median Time to First Success). Target: < 15 minutes.
   - If MTTFS > 20m, the next sprint must focus *exclusively* on simplify/onboarding.
2. **ENTROPY SCAN (5-10m)**:
   - Review "Red Flag" Dashboard.
   - Identify "Orphan Routes" (zero traffic in 30 days). **Kill them.**
   - Audit action density. If screens are becoming "noisy," initiate a Consolidation Sprint.
3. **FEATURE KILL LIST (10-15m)**:
   - Identify the bottom 10% usage features.
   - Can they be moved to "Library" as optional Skills? If yes, de-couple them.
   - If no utility, remove them to reduce test surface.

## QUARTERLY RESET CHECKLIST

- [ ] **Architecture Audit**: Do we still adhere to the Merkle-tree verification for all runs?
- [ ] **Dependency Purge**: Update only what is needed. Remove any library used by < 2 components.
- [ ] **Design Token Hardening**: Ensure no hardcoded colors have drifted into the CSS.
- [ ] **Pricing Alignment**: Are the "Upgrade Triggers" actually firing? Audit the conversion path.

## DRIFT RECOVERY PROTOCOL

If the Anti-Sprawl CI check starts failing consistently:
1. **FREEZE**: No new features for 7 days.
2. **PURGE**: Delete 1 route for every 1 illegal route proposed.
3. **UNIFY**: Force-merge any divergent component patterns (e.g., merging 3 different "Button" styles into a single primitive).
