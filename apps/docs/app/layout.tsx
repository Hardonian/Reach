import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reach - Deterministic Decision Engine",
  description:
    "High-performance, deterministic decision engine for autonomous agents and complex workflows",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
