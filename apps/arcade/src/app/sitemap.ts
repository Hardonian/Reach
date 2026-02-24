import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://reach-cli.com';

  const routes = [
    '', '/', '/docs', '/gallery', '/download', '/security', '/whitepaper', '/roadmap', '/enterprise', '/contact',
  ];

  return [...new Set(routes)].map((route) => ({
    url: `${baseUrl}${route === '/' ? '' : route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' || route === '/' ? 1 : 0.7,
  }));
}
