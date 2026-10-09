# First Success — Canonical Definition

## What is "First Success"?

**First success** = A user sees a concrete ReadyLayer result with a clear **pass / fail / needs-attention** badge AND one actionable suggestion, produced from either:

- A **demo run** (pre-signup, on `/playground`)
- A **saved run** (post-signup, from the onboarding checklist)

This definition is the source of truth for landing copy, app flows, docs, and OSS onboarding. Every surface must point toward the same moment.

---

## The Moment (UX)

> The user clicks "Run Demo Check" → sees a result card with:
>
> - A badge: ✅ **Pass** | ⚠️ **Needs Attention** | ❌ **Fail**
> - One human-readable finding (e.g. "Tool call exceeded timeout budget")
> - One recommended fix (e.g. "Set `timeout_ms: 3000` in your agent config")
>
> They understand what happened and what to do next — without reading docs.

---

## Instrumentation Events

These event names are the canonical identifiers for analytics, funnels, and A/B tests.

| Event                               | When fired                                    | Key properties                                             |
| ----------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `first_success_demo_run_started`    | User clicks "Run Demo Check" on `/playground` | `variant_id`, `source`                                     |
| `first_success_demo_run_completed`  | Demo result card rendered                     | `variant_id`, `result_status`, `duration_ms`               |
| `first_success_saved_run_completed` | Post-signup run saved to workspace            | `user_id`, `tenant_id`, `result_status`                    |
| `signup_started`                    | User clicks any signup CTA                    | `source`, `method` (github/magic_link/email), `variant_id` |
| `signup_completed`                  | Account created successfully                  | `user_id`, `method`                                        |
| `oauth_signup_completed`            | GitHub OAuth flow finished                    | `user_id`                                                  |
| `magic_link_signup_completed`       | Magic link flow finished                      | `user_id`                                                  |
| `onboarding_checklist_completed`    | All 5 checklist steps done                    | `user_id`, `tenant_id`, `duration_ms`                      |

---

## Time-to-Value Targets

| Milestone                               | Target       |
| --------------------------------------- | ------------ |
| Visitor understands problem + solution  | < 10 seconds |
| Visitor runs meaningful demo (no login) | < 30 seconds |
| User reaches first success post-signup  | < 2 minutes  |
| Onboarding checklist complete           | < 5 minutes  |

---

## Consistent Framing Across Surfaces

| Surface         | First-success framing                         |
| --------------- | --------------------------------------------- |
| Homepage hero   | "Run a demo (free)" → `/playground`           |
| Playground      | "Run Demo Check (30s)" button                 |
| Post-signup     | Onboarding checklist step 1: "Run demo check" |
| Docs quickstart | "Run your first check" command                |
| OSS README      | "60-second local demo"                        |

---

## Checklist Steps (Onboarding)

1. **Run demo check** — one click, sees result card
2. **Connect your first input** — paste prompt / config / import
3. **See one failure class** — prebuilt example filter
4. **Save & compare runs** — creates baseline
5. **Invite teammate / share link** — optional

Each step has: visible success state + microcopy ≤ 1 sentence + no reading required.
