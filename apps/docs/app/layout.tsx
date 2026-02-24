import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_DOCS_BASE_URL ?? "https://reach-cli.com"),
  title: "Reach - Deterministic Decision Engine",
  description:
    "High-performance, deterministic decision engine for autonomous agents and complex workflows",
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
