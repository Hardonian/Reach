import { MetadataRoute } from 'next';
import { getSiteBaseUrl, getSiteConfigFromEnv } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteConfigFromEnv();
  const baseUrl = getSiteBaseUrl(site);
  const routes =
    site.mode === 'enterprise'
      ? ['/', '/enterprise', '/contact']
      : ['/', '/docs', '/gallery', '/download', '/security', '/whitepaper', '/roadmap'];

  return routes.map((route) => ({
    url: `${baseUrl}${route === '/' ? '' : route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '/' ? 1 : 0.7,
  }));
}
