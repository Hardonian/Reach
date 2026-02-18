import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reach Arcade',
  description: 'Phone-first playful coding and internet fun layer.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <div className="scanlines" />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
