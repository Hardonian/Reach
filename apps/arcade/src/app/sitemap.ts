import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://reach.dev'; // Replace with actual production domain
  
  const routes = [
    '',
    '/docs',
    '/docs/getting-started',
    '/docs/architecture',
    '/docs/agents',
    '/docs/mcp',
    '/docs/deployment',
    '/docs/security',
    '/docs/api',
    '/docs/cli',
    '/docs/integrations',
    '/faq',
    '/support',
    '/support/status',
    '/support/contact',
    '/marketplace',
    '/dashboard',
    '/governance',
    '/legal',
    '/legal/privacy',
    '/legal/terms',
    '/legal/cookies',
    '/security',
    '/transparency',
    '/responsible-disclosure',
    '/pricing',
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));
}
