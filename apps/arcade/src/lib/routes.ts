/**
 * ReadyLayer — Central route registry
 *
 * Canonical route tree:
 *   PRIMARY NAV: Home, Playground, Studio, Templates, Docs, Pricing
 *   USER MENU:   Dashboard, Settings, Billing, Logout
 *   FOOTER:      Status, Changelog, Security, Privacy, Terms, Support
 */

export const ROUTES = {
  // ── Primary Nav ──
  HOME: '/',
  PLAYGROUND: '/playground',
  STUDIO: '/studio',
  TEMPLATES: '/templates',
  DOCS: '/docs',
  PRICING: '/pricing',

  // ── User Menu ──
  DASHBOARD: '/dashboard',
  SETTINGS: {
    HOME: '/settings',
    API_KEYS: '/settings/api-keys',
    PROFILE: '/settings/profile',
    BILLING: '/settings/billing',
    ADVANCED: {
      WEBHOOKS: '/settings/advanced/webhooks',
      SECURITY: '/settings/advanced/security',
    },
  },

  // ── Footer / Misc ──
  CHANGELOG: '/changelog',
  MARKETPLACE: '/marketplace',
  GOVERNANCE: '/governance',
  FAQ: '/faq',
  SUPPORT: '/support',
  CONTACT: '/contact',
  SECURITY: '/security',

  // ── Auth ──
  CLOUD: '/cloud',
  LOGIN: '/cloud/login',
  REGISTER: '/cloud/register',

  // ── Legal ──
  LEGAL: {
    TERMS: '/legal/terms',
    PRIVACY: '/legal/privacy',
    COOKIES: '/legal/cookies',
  },

  // ── Console (enterprise, behind auth) ──
  CONSOLE: {
    HOME: '/console',
    NAV: '/console/nav',
    AGENTS: {
      HOME: '/console/agents',
      DETAIL: '/console/agents/detail',
      COLLISIONS: '/console/agents/collisions',
      IMPACT: '/console/agents/impact',
    },
    RUNNERS: '/console/runners',
    OPS: {
      HOME: '/console/ops',
      SANDBOX: '/console/ops/sandbox',
    },
    EVALUATION: {
      HOME: '/console/evaluation',
      REGRESSION: '/console/evaluation/regression',
    },
    SAFETY: '/console/safety',
    GOVERNANCE: {
      HOME: '/console/governance',
      GLOSSARY: '/console/governance/glossary',
      HISTORY: '/console/governance/history',
      CONFIG: '/console/governance/config-as-code',
      AUDIT: '/console/governance/audit-gate',
    },
    DATASETS: '/console/datasets',
    COST: {
      HOME: '/console/cost',
      ROI: '/console/cost/roi',
      HEATMAP: '/console/cost/heatmap',
    },
    BILLING: '/console/billing',
    ECOSYSTEM: {
      HOME: '/console/ecosystem',
      REPO_SYNC: '/console/ecosystem/repo-sync',
    },
    INTEGRATIONS: '/console/integrations',
    DEPLOY: {
      CD: '/console/deploy/cd',
    },
    ARTIFACTS: '/console/artifacts',
    ALERTS: '/console/alerts',
    TRACES: '/console/traces',
    SEARCH: '/console/search',
    WORKSPACES: '/console/workspaces',
    PROFILE: '/console/profile',
    REPORTS: {
      STATUS: '/console/reports/status',
      MONTHLY: '/console/reports/monthly',
      PDF: '/console/reports/pdf-export',
    },
    SCREENS: {
      GENERATED: '/console/screens/generated',
    }
  },

  // ── Public web pages ──
  WEB: {
    ARCHITECTURE: '/architecture',
    TRANSPARENCY: '/transparency',
  },

  // ── API ──
  API: {
    RUN: '/api/run',
    V1: {
      PROJECTS: '/api/v1/projects',
      WORKFLOWS: '/api/v1/workflows',
      TENANTS: '/api/v1/tenants',
      EVENTS: '/api/v1/events',
      PLAYGROUND: '/api/v1/playground',
      API_KEYS: '/api/v1/api-keys',
      AUTH: {
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/logout',
        REGISTER: '/api/v1/auth/register',
        ME: '/api/v1/auth/me',
        MAGIC_LINK: '/api/v1/auth/magic-link',
        GITHUB: '/api/v1/auth/github',
        GITHUB_CALLBACK: '/api/v1/auth/github/callback',
      },
    },
  },
} as const;

export type RoutePath = string;

