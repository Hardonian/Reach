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
    display: "Policy",
    tooltip:
      "Policy: Declarative rules your agent must obey, enforced by the deterministic engine.",
  },
  drift: {
    display: "Drift",
    tooltip: "Drift: When behavior changes over time, detected by bit-identical replay.",
  },
  gate: {
    display: "CI Gate",
    tooltip: "CI Gate: Automated blocking of non-compliant builds.",
  },
  trace: {
    display: "Transcript",
    tooltip: "Transcript: The complete, ordered log of every event and decision.",
  },
  signal: {
    display: "Evidence",
    tooltip: "Evidence: Cryptographically linked data points that prove execution integrity.",
  },
  run_artifacts: {
    display: "Capsules",
    tooltip: "Capsules: Portable, signed bundles containing everything needed for replay.",
  },
};

/** Hero copy variants with Category Lock */
export const HERO_VARIANTS = {
  A: {
    headline: "Agent Governance. Deterministic.",
    subhead:
      "Reach provides the cryptographic provenance and bit-identical replayability required to scale AI safely.",
    badge: "OSS Engine + Pro Cloud",
  },
  B: {
    headline: "Stop the drift. Ship with proof.",
    subhead:
      "The open-source infrastructure for safe, predictable, and auditable AI agent ecosystems.",
    badge: "Reliability Suite",
  },
  C: {
    headline: "Zero drift. Zero doubt.",
    subhead: "Automated gates and side-by-side simulation for production agents.",
    badge: "Pro Grade",
  },
} as const;

export type HeroVariant = keyof typeof HERO_VARIANTS;

/** CTA copy variants */
export const CTA = {
  primary: "Run demo (free)",
  primaryAlt: "Try instantly",
  secondary: "Get started for free",
  sales: "Talk to us",
  saveRun: "Save this run",
  signupCta: "Start free — no card required",
  reassurance: "No credit card. Works locally. OSS-friendly.",
} as const;

/** Onboarding checklist copy */
export const CHECKLIST = [
  {
    id: "demo_run",
    title: "Run Demo",
    description: "See a real report in 30 seconds.",
    cta: "Run now",
    completedLabel: "Demo check done",
  },
  {
    id: "connect_repo",
    title: "Connect Repo",
    description: "Link your logic for automated checks.",
    cta: "Connect",
    completedLabel: "Repo connected",
  },
  {
    id: "save_baseline",
    title: "Set Baseline",
    description: 'Save a "Pass" run to catch future drifts.',
    cta: "Save baseline",
    completedLabel: "Baseline saved",
  },
  {
    id: "active_gate",
    title: "Active Gate",
    description: "Connect to GitHub to block broken PRs.",
    cta: "Connect GitHub",
    completedLabel: "Gate active",
  },
  {
    id: "invite",
    title: "Invite Team",
    description: "Share results with your engineers.",
    cta: "Invite",
    completedLabel: "Teammates invited",
  },
] as const;

export type ChecklistItemId = (typeof CHECKLIST)[number]["id"];

/** How-it-works steps (outcome-framed) */
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Run a check",
    description: "Point ReadyLayer at your agent. It runs a suite of readiness checks instantly.",
    icon: "▶",
  },
  {
    step: "02",
    title: "Fix what breaks",
    description: "Get plain-English explanations and specific fix suggestions for every finding.",
    icon: "⚡",
  },
  {
    step: "03",
    title: "Ship with confidence",
    description: "Gate your CI/CD on a green score. Never merge a broken agent again.",
    icon: "✓",
  },
] as const;

/** Core capabilities (show first 3 above fold, rest behind "Show more") */
export const CAPABILITIES = [
  {
    title: "CI Gates",
    description: "Automated PR checks to stop non-compliant agent behavior before merge.",
    href: "/docs/quick-start",
    primary: true,
  },
  {
    title: "Transcripts & Replay",
    description: "Bit-identical replay of any production event for 100% audit integrity.",
    href: "/docs/execution",
    primary: true,
  },
  {
    title: "Drift Detection",
    description: "Real-time alerts when agent behavior diverges from the deterministic baseline.",
    href: "/docs/observability",
    primary: true,
  },
  {
    title: "Policy Engine",
    description: "Natural-language policy generation backed by durable governance memory.",
    href: "/docs/governance",
    primary: false,
  },
  {
    title: "MCP Integration",
    description: "Standardized tool access with the Model Context Protocol (MCP).",
    href: "/docs/mcp",
    primary: false,
  },
  {
    title: "Agent Contracts",
    description: "Define and enforce performance and safety SLAs at the protocol level.",
    href: "/enterprise",
    primary: false,
  },
] as const;

/** Before / After comparison data */
export const BEFORE_AFTER = [
  {
    before: "Manually test prompts in a notebook",
    after: "Automated check suite runs in CI",
  },
  {
    before: "Ship and hope it works the same",
    after: "Change detection flags regressions before merge",
  },
  {
    before: "Debug failures in production logs",
    after: "Step-by-step trace shows exactly what went wrong",
  },
  {
    before: "No audit trail for agent decisions",
    after: "Every run logged with full lineage",
  },
] as const;
