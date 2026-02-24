import type { Metadata } from 'next';
import './globals.css';
import '@/components/stitch/stitch.css';

import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { getSiteBaseUrl, getSiteConfig } from '@/lib/site';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const base = site.mode === 'enterprise' ? 'https://ready-layer.com' : 'https://reach-cli.com';
  const base = getSiteBaseUrl(site);

  return {
    metadataBase: new URL(base),
    title: {
      default: site.title,
      template: `%s | ${site.brand}`,
    },
    description: site.description,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: base,
      siteName: site.brand,
      title: site.title,
      description: site.description,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${site.brand} site` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: site.title,
      description: site.description,
      images: ['/twitter-image.png'],
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `${site.brand} platform` }],
    },
    alternates: {
      canonical: '/',
    },
    twitter: {
      card: 'summary_large_image',
      title: site.title,
      description: site.description,
      images: ['/twitter-image.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
      },
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getSiteConfig();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col font-sans">
        <NavBar site={site} />
        <main className="flex-1">{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}
