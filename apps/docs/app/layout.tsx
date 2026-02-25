import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? "https://reach-cli.com"),
  title: {
    default: "Reach - Deterministic Decision Engine",
    template: "%s | Reach",
  },
  description:
    "High-performance, deterministic decision engine for autonomous agents and complex workflows. Bit-identical replayability for auditable AI.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Reach - Deterministic Decision Engine",
    description: "High-performance, deterministic decision engine for autonomous agents.",
    url: "https://reach-cli.com",
    siteName: "Reach",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reach - Deterministic Decision Engine",
    description: "High-performance, deterministic decision engine for autonomous agents.",
    creator: "@reach_cli",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
