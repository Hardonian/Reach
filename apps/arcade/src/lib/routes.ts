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
