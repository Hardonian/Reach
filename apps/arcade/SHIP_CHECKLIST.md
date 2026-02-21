# SHIP CHECKLIST: ReadyLayer UX Polish

Status: **Production Ready**
Version: 1.0.0 (Rev 2)

---

## 1. Activations Flow

- [ ] **Homepage Hero:** Verify headline is "Your agent is smart. Is it shippable?" or similar (Variant B preferred).
- [ ] **Primary CTA:** All "Run demo (free)" buttons map to `/playground`.
- [ ] **Onboarding Checklist:** Verify all 5 items (`demo_run`, `connect_repo`, `save_baseline`, `active_gate`, `invite`) are present on `/dashboard`.
- [ ] **Progressive Disclosure:** Clicking "Run now" in checklist correctly advances state.

## 2. Suite Modules

- [ ] **Agent Lab:** Verify Orchestration Studio is renamed to "Agent Lab" on `/studio`.
- [ ] **Simulation:** Verify "Best Variant" badge appears on passing runs in `/simulate`.
- [ ] **Monitoring:** Verify empty state shows "Start monitoring" with "monitor_heart" icon on `/monitoring`.
- [ ] **Reports:** Verify shared reports (/reports/share/[slug]) show Verdict Badges and Recommendation blocks.

## 3. IA & Navigation

- [ ] **Primary Nav:** Limited to 6 items (Home, Playground, Lab, Templates, Docs, Pricing).
- [ ] **Routes Registry:** `ROUTES.CONSOLE` replaced by `ROUTES.SUITE`. `ROUTES.STUDIO` replaced by `ROUTES.LAB`.
- [ ] **Footer:** "Legal" consolidated into "Trust Center".
- [ ] **Accessibility:** Title attributes on all dropdowns/selects in Lab.
- [ ] **Linting:** Zero `flex-shrink-0` warnings.

## 4. Documentation

- [ ] **Quickstart:** Verify `/docs/quick-start` follows the 5-step action flow.
- [ ] **No Placeholders:** All docs point to actual product routes (Playground, Lab, etc).

## 5. Decision Log

- [ ] **Deterministic IDs:** Checklist completion stored in localStorage for local persistence.
- [ ] **Analytics:** `track()` calls verified for CTA clicks and onboarding completion.
- [ ] **Terminology:** "Prompting" -> "Rules", "Input" -> "Repo", "Output" -> "Pass Rate".
