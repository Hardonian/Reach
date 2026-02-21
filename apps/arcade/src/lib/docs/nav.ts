export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const sidebarItems: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Overview', href: '/docs' },
      { title: 'Quick Start', href: '/docs/quick-start' },
      { title: 'Installation', href: '/docs/installation' },
      { title: 'Configuration', href: '/docs/configuration' },
    ],
  },
  {
    title: 'Core Architecture',
    items: [
      { title: 'Architecture Deep Dive', href: '/docs/architecture' },
      { title: 'Agents & Roles', href: '/docs/agents' },
      { title: 'Model Context Protocol', href: '/docs/mcp' },
      { title: 'Deterministic Engine', href: '/docs/engine' },
      { title: 'Orchestration', href: '/docs/orchestration' },
    ],
  },
  {
    title: 'Runtime',
    items: [
      { title: 'Skills System', href: '/docs/skills' },
      { title: 'Tool Registry', href: '/docs/tools' },
      { title: 'Provider Routing', href: '/docs/providers' },
      { title: 'Execution Graph', href: '/docs/execution' },
    ],
  },
  {
    title: 'Tooling & Interface',
    items: [
      { title: 'CLI Reference', href: '/docs/cli' },
      { title: 'Studio Guide', href: '/docs/studio' },
      { title: 'Marketplace', href: '/docs/marketplace' },
      { title: 'Dashboard', href: '/docs/dashboard' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { title: 'Deployment', href: '/docs/deployment' },
      { title: 'Security', href: '/docs/security' },
      { title: 'Auth & RBAC', href: '/docs/auth' },
      { title: 'Observability', href: '/docs/observability' },
      { title: 'Pipelines', href: '/docs/pipelines' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { title: 'API Reference', href: '/docs/api' },
      { title: 'API Endpoints', href: '/docs/endpoints' },
      { title: 'Webhooks', href: '/docs/webhooks' },
      { title: 'Governance', href: '/docs/governance' },
      { title: 'Integrations', href: '/docs/integrations' },
      { title: 'Error Codes', href: '/docs/errors' },
    ],
  },
];

export const allNavItemSlugs = sidebarItems.flatMap(section => section.items.map(item => item.href));
