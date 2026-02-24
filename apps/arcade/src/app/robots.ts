import { MetadataRoute } from 'next';
import { getSiteBaseUrl, getSiteConfigFromEnv } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const site = getSiteConfigFromEnv();
  const baseUrl = getSiteBaseUrl(site);

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/_next/', '/static/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: site.domain,
  };
}
