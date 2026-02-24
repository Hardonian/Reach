import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/components/stitch/stitch.css';

import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { getSiteConfig } from '@/lib/site';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteConfig();
  const base = `https://${site.domain}`;
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
    },
    alternates: {
      canonical: base,
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
    <html lang="en" className={inter.variable}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <NavBar site={site} />
        <main className="flex-1">{children}</main>
        <Footer site={site} />
      </body>
    </html>
  );
}
