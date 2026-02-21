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
    tooltip: 'Rules define what your agent is and isn\'t allowed to do.',
  },
  run_artifacts: {
    display: 'Reports',
    tooltip: 'Reports are saved snapshots of a check run — what passed, what failed, and why.',
  },
  deterministic_pipeline: {
    display: 'Repeatable checks',
    tooltip: 'Same input always produces the same result — no surprises in CI.',
  },
  observability: {
    display: 'See what happened',
    tooltip: 'Full trace of every step your agent took, visible in one click.',
  },
  orchestration: {
    display: 'Run coordination',
    tooltip: 'Runs multiple checks in order and combines their results.',
  },
  evaluation: {
    display: 'Checks',
    tooltip: 'Tests that verify your agent behaves correctly before you ship.',
  },
  governance: {
    display: 'Controls',
    tooltip: 'Who can do what, and what gets logged — for teams and compliance.',
  },
  regression: {
    display: 'Change detection',
    tooltip: 'Alerts you when a new build behaves differently than a previous one.',
  },
  sandbox: {
    display: 'Safe test zone',
    tooltip: 'Your agent runs here in isolation — no real side-effects.',
  },
  trace: {
    display: 'Step-by-step log',
    tooltip: 'Every action your agent took, in order, with timestamps.',
  },
};

/** Hero copy variants for A/B testing */
export const HERO_VARIANTS = {
  A: {
    headline: 'Ship reliable AI agents.',
    subhead: 'Run a readiness check in minutes. Catch regressions, unsafe behavior, and tool failures before prod.',
    badge: 'Now in open beta',
  },
  B: {
    headline: 'Your agent is smart. Is it shippable?',
    subhead: 'ReadyLayer turns "works on my prompt" into repeatable releases.',
    badge: 'Free to start',
  },
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

/** CTA copy variants */
export const CTA = {
  primary: 'Run a demo (free)',
  primaryAlt: 'Try instantly',
  secondary: 'Start free',
  sales: 'Talk to an engineer',
  saveRun: 'Save this run',
  signupCta: 'Start free — no card required',
  reassurance: 'No credit card. Works locally. OSS-friendly.',
} as const;

/** Onboarding checklist copy */
export const CHECKLIST = [
  {
    id: 'demo_run',
    title: 'Run a demo check',
    description: 'See a real result in under 30 seconds.',
    cta: 'Run now',
    completedLabel: 'Demo check done',
  },
  {
    id: 'connect_input',
    title: 'Connect your first input',
    description: 'Paste a prompt, config, or import from your repo.',
    cta: 'Connect',
    completedLabel: 'Input connected',
  },
  {
    id: 'see_failure',
    title: 'See one failure class',
    description: 'We\'ll show you a prebuilt example of what can go wrong.',
    cta: 'Show example',
    completedLabel: 'Failure class viewed',
  },
  {
    id: 'save_baseline',
    title: 'Save & compare runs',
    description: 'Create a baseline so future changes show diffs.',
    cta: 'Save baseline',
    completedLabel: 'Baseline saved',
  },
  {
    id: 'invite',
    title: 'Invite a teammate',
    description: 'Share a link or add them to your workspace.',
    cta: 'Invite',
    completedLabel: 'Teammate invited',
  },
] as const;

export type ChecklistItemId = typeof CHECKLIST[number]['id'];

/** How-it-works steps (outcome-framed) */
export const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Run a check',
    description: 'Point ReadyLayer at your agent. It runs a suite of readiness checks — tool calls, policy gates, regression diffs.',
    icon: '▶',
  },
  {
    step: '02',
    title: 'Fix what breaks',
    description: 'Each finding comes with a plain-English explanation and a specific fix suggestion.',
    icon: '⚡',
  },
  {
    step: '03',
    title: 'Ship with confidence',
    description: 'Gate your CI/CD on a green readiness score. Never merge a broken agent again.',
    icon: '✓',
  },
] as const;

/** Core capabilities (show first 3 above fold, rest behind "Show more") */
export const CAPABILITIES = [
  {
    title: 'Readiness checks',
    description: 'Automated suite: tool calls, timeouts, policy gates, and behavior regressions.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'Change detection',
    description: 'Compare runs side-by-side. See exactly what changed between builds.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'Rules engine',
    description: 'Define what your agent can and can\'t do. Enforce at every run.',
    href: '/docs/quick-start',
    primary: true,
  },
  {
    title: 'Step-by-step logs',
    description: 'Full execution trace for every check — every tool call, every decision.',
    href: '/docs/quick-start',
    primary: false,
  },
  {
    title: 'CI/CD gate',
    description: 'Block merges that regress agent behavior. Works with GitHub Actions.',
    href: '/docs/quick-start',
    primary: false,
  },
  {
    title: 'Team controls',
    description: 'Role-based access and audit logs for compliance-conscious teams.',
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
