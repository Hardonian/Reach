import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/components/stitch/stitch.css';

import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://reach.dev'),
  title: {
    default: `${process.env.NEXT_PUBLIC_BRAND_NAME ?? 'ReadyLayer'} - Deterministic Orchestration Fabric`,
    template: `%s | ${process.env.NEXT_PUBLIC_BRAND_NAME ?? 'ReadyLayer'}`,
  },
  description: 'Global orchestration platform for distributed agents, marketplace, and deterministic governance.',
  keywords: ['AI agents', 'orchestration', 'determinism', 'governance', 'readylayer', 'reach protocol'],
  authors: [{ name: 'ReadyLayer Team' }],
  creator: 'ReadyLayer',
  publisher: 'ReadyLayer',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://reach.dev',
    siteName: 'ReadyLayer',
    title: 'ReadyLayer - Deterministic Orchestration Fabric',
    description: 'Scale AI agents with confidence. Deterministic governance and lifecycle management.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ReadyLayer Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReadyLayer - Deterministic Orchestration Fabric',
    description: 'Scale AI agents with confidence. Deterministic governance and lifecycle management.',
    images: ['/twitter-image.png'],
    creator: '@readylayer',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col font-sans">
        <NavBar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
