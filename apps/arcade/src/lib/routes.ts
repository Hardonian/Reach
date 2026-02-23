/**
 * ReadyLayer — Central route registry
 *
 * Canonical route tree:
 *   PRIMARY NAV: Home (/), Playground (/playground), Lab (/studio), Templates (/templates), Docs (/docs), Pricing (/pricing)
 *   USER MENU:   Dashboard (/dashboard), Monitor (/monitoring), Lab (/simulate), Settings (/settings), Billing (/settings/billing), Logout
 *   FOOTER:      Status (/status), Changelog (/changelog), Trust (/legal), Privacy (/privacy), Terms (/terms), Support (/support)
 */

export const ROUTES = {
  // ── Primary Nav ──
  HOME: "/",
  PLAYGROUND: "/playground",
  SKILLS: "/skills",
  TOOLS: "/tools",
  STUDIO: "/studio",
  LAB: "/studio",
  LIBRARY: "/library",
  MARKETPLACE: "/marketplace",
  TEMPLATES: "/templates",
  DOCS: "/docs",
  PRICING: "/pricing",

  // ── User Menu ──
  DASHBOARD: "/dashboard",
  MONITORING: "/monitoring",
  SIMULATE: "/simulate",
  REPORTS: "/reports",
  SETTINGS: {
    HOME: "/settings",
    API_KEYS: "/settings/api-keys",
    PROFILE: "/settings/profile",
    BILLING: "/settings/billing",
    ADVANCED: {
      WEBHOOKS: "/settings/advanced/webhooks",
      SECURITY: "/settings/advanced/security",
      RELEASE_GATES: "/settings/release-gates",
      ALERTS: "/settings/alerts",
    },
  },

  // ── Footer / Misc ──
  CHANGELOG: "/changelog",
  LIBRARY_LEGACY: "/templates", // Use LIBRARY instead
  MARKETPLACE_LEGACY: "/marketplace", // Use LIBRARY instead
  GOVERNANCE: "/governance",
  FAQ: "/faq",
  SUPPORT: "/support",
  CONTACT: "/contact",
  SECURITY: "/security",

  // ── Auth ──
  CLOUD: "/cloud",
  LOGIN: "/cloud/login",
  REGISTER: "/cloud/register",

  // ── Trust & Compliance ──
  TRUST: {
    HOME: "/legal",
    TERMS: "/legal/terms",
    PRIVACY: "/legal/privacy",
    COOKIES: "/legal/cookies",
    SECURITY: "/security",
    DISCLOSURE: "/responsible-disclosure",
  },

  CONSOLE: {
    HOME: "/console",
    NAV: "/console/nav",
    AGENTS: {
      HOME: "/console/agents",
      DETAIL: "/console/agents/detail",
      COLLISIONS: "/console/agents/collisions",
      IMPACT: "/console/agents/impact",
    },
    RUNNERS: "/console/runners",
    OPS: {
      HOME: "/console/ops",
      SANDBOX: "/console/ops/sandbox",
    },
    EVALUATION: {
      HOME: "/console/evaluation",
      REGRESSION: "/console/evaluation/regression",
    },
    SAFETY: "/console/safety",
    GOVERNANCE: {
      HOME: "/console/governance",
      GLOSSARY: "/console/governance/glossary",
      HISTORY: "/console/governance/history",
      CONFIG: "/console/governance/config-as-code",
      AUDIT: "/console/governance/audit-gate",
    },
    DATASETS: "/console/datasets",
    COST: {
      HOME: "/console/cost",
      ROI: "/console/cost/roi",
      HEATMAP: "/console/cost/heatmap",
    },
    BILLING: "/console/billing",
    ECOSYSTEM: {
      HOME: "/console/ecosystem",
      REPO_SYNC: "/console/ecosystem/repo-sync",
    },
    INTEGRATIONS: "/console/integrations",
    DEPLOY: {
      CD: "/console/deploy/cd",
    },
    ARTIFACTS: "/console/artifacts",
    ALERTS: "/console/alerts",
    TRACES: "/console/traces",
    SEARCH: "/console/search",
    WORKSPACES: "/console/workspaces",
    PROFILE: "/console/profile",
    REPORTS: {
      STATUS: "/console/reports/status",
      MONTHLY: "/console/reports/monthly",
      PDF: "/console/reports/pdf-export",
    },
    SCREENS: {
      GENERATED: "/console/screens/generated",
    },
    FOUNDER: "/console/founder",
  },

  // ── Suite (enterprise, behind auth) ──
  SUITE: {
    HOME: "/console",
    NAV: "/console/nav",
    AGENTS: {
      HOME: "/console/agents",
      DETAIL: "/console/agents/detail",
      COLLISIONS: "/console/agents/collisions",
      IMPACT: "/console/agents/impact",
    },
    RUNNERS: "/console/runners",
    OPS: {
      HOME: "/console/ops",
      SANDBOX: "/console/ops/sandbox",
    },
    EVALUATION: {
      HOME: "/console/evaluation",
      REGRESSION: "/console/evaluation/regression",
    },
    SAFETY: "/console/safety",
    GOVERNANCE: {
      HOME: "/console/governance",
      GLOSSARY: "/console/governance/glossary",
      HISTORY: "/console/governance/history",
      CONFIG: "/console/governance/config-as-code",
      AUDIT: "/console/governance/audit-gate",
    },
    DATASETS: "/console/datasets",
    COST: {
      HOME: "/console/cost",
      ROI: "/console/cost/roi",
      HEATMAP: "/console/cost/heatmap",
    },
    BILLING: "/console/billing",
    ECOSYSTEM: {
      HOME: "/console/ecosystem",
      REPO_SYNC: "/console/ecosystem/repo-sync",
    },
    INTEGRATIONS: "/console/integrations",
    DEPLOY: {
      CD: "/console/deploy/cd",
    },
    ARTIFACTS: "/console/artifacts",
    ALERTS: "/console/alerts",
    TRACES: "/console/traces",
    SEARCH: "/console/search",
    WORKSPACES: "/console/workspaces",
    PROFILE: "/console/profile",
    REPORTS: {
      STATUS: "/console/reports/status",
      MONTHLY: "/console/reports/monthly",
      PDF: "/console/reports/pdf-export",
    },
    SCREENS: {
      GENERATED: "/console/screens/generated",
    },
    FOUNDER: "/console/founder",
  },

  // ── Public web pages ──
  WEB: {
    ARCHITECTURE: "/architecture",
    TRANSPARENCY: "/transparency",
  },

  // ── API ──
  API: {
    RUN: "/api/run",
    GITHUB_WEBHOOK: "/api/github/webhook",
    CI_INGEST: "/api/ci/ingest",
    MONITOR_INGEST: "/api/monitor/ingest",
    V1: {
      PROJECTS: "/api/v1/projects",
      WORKFLOWS: "/api/v1/workflows",
      TENANTS: "/api/v1/tenants",
      EVENTS: "/api/v1/events",
      PLAYGROUND: "/api/v1/playground",
      SKILLS: "/api/v1/skills",
      TOOLS: "/api/v1/tools",
      PROVIDERS: "/api/v1/providers",
      EXECUTE: "/api/v1/execute",
      API_KEYS: "/api/v1/api-keys",
      GATES: "/api/v1/gates",
      SIGNALS: "/api/v1/signals",
      SCENARIOS: "/api/v1/scenarios",
      ALERTS: "/api/v1/alerts",
      REPORTS: "/api/v1/reports",
      AUTH: {
        LOGIN: "/api/v1/auth/login",
        LOGOUT: "/api/v1/auth/logout",
        REGISTER: "/api/v1/auth/register",
        ME: "/api/v1/auth/me",
        MAGIC_LINK: "/api/v1/auth/magic-link",
        GITHUB: "/api/v1/auth/github",
        GITHUB_CALLBACK: "/api/v1/auth/github/callback",
      },
    },
  },
} as const;

export type RoutePath = string;
