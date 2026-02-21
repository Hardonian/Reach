/**
 * ReadyLayer UI Copy Registry
 *
 * Centralizes user-facing strings so they can be:
 *  - Scanned by CI for jargon violations
 *  - Swapped via A/B variants
 *  - Kept consistent across all surfaces
 *
 * Rules:
 *  - No paragraph longer than 2 sentences per entry
 *  - Prefer action language over technical nouns
 *  - Each key maps to { display, tooltip? } so we can show first-time hints
 */

export interface CopyEntry {
  /** The display string shown in UI */
  display: string;
  /** Optional tooltip text for first-time term exposure */
  tooltip?: string;
}

/** Terminology translation map — replaces jargon with action language */
export const TERMS: Record<string, CopyEntry> = {
  policy: {
    display: 'Rules',
    tooltip: 'Rules: Rules your agent must obey.',
  },
  drift: {
    display: 'Drift',
    tooltip: 'Drift: When behavior changes over time.',
  },
  gate: {
    display: 'Gate',
    tooltip: 'Gate: Automated block for bad builds.',
  },
  trace: {
    display: 'Trace',
    tooltip: 'Trace: Step-by-step history of actions.',
  },
  signal: {
    display: 'Signal',
    tooltip: 'Signal: Real-time health data points.',
  },
  run_artifacts: {
    display: 'Reports',
    tooltip: 'Reports are saved snapshots of a check run.',
  },
};

/** Hero copy variants for A/B testing */
export const HERO_VARIANTS = {
  A: {
    headline: 'Your agent is smart. Is it shippable?',
    subhead: 'ReadyLayer turns "it works on my prompt" into repeatable, safe releases.',
    badge: 'Now in open beta',
  },
  B: {
    headline: 'Ship AI agents without the "maybe".',
    subhead: 'Automated readiness checks for tool calls, policy gates, and regressions.',
    badge: 'Free to start',
  },
  C: {
    headline: 'Zero to CI readiness in 30 seconds.',
    subhead: 'Stop guessing if your latest prompt broke your agent. Verify it instantly.',
    badge: 'Demo-first',
  },
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

/** CTA copy variants */
export const CTA = {
  primary: 'Run demo (free)',
  primaryAlt: 'Try instantly',
  secondary: 'Get started for free',
  sales: 'Talk to us',
  saveRun: 'Save this run',
  signupCta: 'Start free — no card required',
  reassurance: 'No credit card. Works locally. OSS-friendly.',
} as const;

/** Onboarding checklist copy */
export const CHECKLIST = [
  {
    id: 'demo_run',
    title: 'Run Demo',
    description: 'See a real report in 30 seconds.',
    cta: 'Run now',
    completedLabel: 'Demo check done',
  },
  {
    id: 'connect_repo',
    title: 'Connect Repo',
    description: 'Link your logic for automated checks.',
    cta: 'Connect',
    completedLabel: 'Repo connected',
  },
  {
    id: 'save_baseline',
    title: 'Set Baseline',
    description: 'Save a "Pass" run to catch future drifts.',
    cta: 'Save baseline',
    completedLabel: 'Baseline saved',
  },
  {
    id: 'active_gate',
    title: 'Active Gate',
    description: 'Connect to GitHub to block broken PRs.',
    cta: 'Connect GitHub',
    completedLabel: 'Gate active',
  },
  {
    id: 'invite',
    title: 'Invite Team',
    description: 'Share results with your engineers.',
    cta: 'Invite',
    completedLabel: 'Teammates invited',
  },
] as const;

export type ChecklistItemId = typeof CHECKLIST[number]['id'];

/** How-it-works steps (outcome-framed) */
export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Run a check',
    description: 'Point ReadyLayer at your agent. It runs a suite of readiness checks instantly.',
    icon: '▶',
  },
  {
    step: '02',
    title: 'Fix what breaks',
    description: 'Get plain-English explanations and specific fix suggestions for every finding.',
    icon: '⚡',
  },
  {
    step: '03',
    title: 'Ship with confidence',
    description: 'Gate your CI/CD on a green score. Never merge a broken agent again.',
    icon: '✓',
  },
] as const;

/** Core capabilities (show first 3 above fold, rest behind "Show more") */
export const CAPABILITIES = [
  {
    title: 'Release Gates',
    description: 'Automated PR checks to stop shipping broken agents.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'CI Ingestion',
    description: 'Local test integration for your terminal workflows.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'Monitoring',
    description: 'Post-ship health tracking to catch failures early.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'Simulation',
    description: 'Side-by-side experiments to find the best variants.',
    href: '/docs/quick-start',
    primary: false,
  },
  {
    title: 'Rules Engine',
    description: 'Define agent boundaries and enforce them at every run.',
    href: '/docs/quick-start',
    primary: false,
  },
  {
    title: 'Traceability',
    description: 'Step-by-step logs for every decision your agent makes.',
    href: '/docs/quick-start',
    primary: false,
  },
] as const;

/** Before / After comparison data */
export const BEFORE_AFTER = [
  {
    before: 'Manually test prompts in a notebook',
    after: 'Automated check suite runs in CI',
  },
  {
    before: 'Ship and hope it works the same',
    after: 'Change detection flags regressions before merge',
  },
  {
    before: 'Debug failures in production logs',
    after: 'Step-by-step trace shows exactly what went wrong',
  },
  {
    before: 'No audit trail for agent decisions',
    after: 'Every run logged with full lineage',
  },
] as const;
