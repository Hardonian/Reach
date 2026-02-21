/**
 * Reach Arcade — Central route registry
 */

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  MARKETPLACE: '/marketplace',
  GOVERNANCE: '/governance',
  DOCS: '/docs',
  FAQ: '/faq',
  SUPPORT: '/support',
  CONTACT: '/contact',
  STUDIO: '/studio',
  PRICING: '/pricing',
  CLOUD: '/cloud',
  LOGIN: '/cloud/login',
  REGISTER: '/cloud/register',
  LEGAL: {
    TERMS: '/legal/terms',
    PRIVACY: '/legal/privacy',
    COOKIES: '/legal/cookies',
  },
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
  WEB: {
    ARCHITECTURE: '/architecture',
    TRANSPARENCY: '/transparency',
    MARKETPLACE_STITCH: '/marketplace-alt', // Avoid collision if /marketplace is standard
  },
  API: {
    RUN: '/api/run',
    V1: {
      PROJECTS: '/api/v1/projects',
      WORKFLOWS: '/api/v1/workflows',
      TENANTS: '/api/v1/tenants',
      AUTH: {
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/logout',
        REGISTER: '/api/v1/auth/register',
        ME: '/api/v1/auth/me',
      },
    },
  },
} as const;

export type RoutePath = string;

