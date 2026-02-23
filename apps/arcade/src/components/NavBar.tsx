"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { BRAND_NAME } from "@/lib/brand";
import { track } from "@/lib/analytics";
import { OSSModeBanner } from "./OSSModeBanner";

const primaryNav = [
  { href: ROUTES.PLAYGROUND, label: "Playground" },
  { href: ROUTES.SKILLS, label: "Skills" },
  { href: ROUTES.TOOLS, label: "Tools" },
  { href: ROUTES.STUDIO, label: "Studio" },
  { href: ROUTES.TEMPLATES, label: "Templates" },
  { href: ROUTES.LIBRARY, label: "Build (Library)" },
  { href: ROUTES.REPORTS, label: "Run (Reports)" },
  { href: ROUTES.SIMULATE, label: "Simulation" },
  { href: ROUTES.DOCS, label: "Docs" },
  { href: ROUTES.PRICING, label: "Pricing" },
  { href: ROUTES.SETTINGS.HOME, label: "Manage" },
];

export function NavBar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border">
      <OSSModeBanner />
      <nav className="section-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={ROUTES.HOME} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-gradient">{BRAND_NAME}</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href || pathname?.startsWith(item.href + "/")
                    ? "text-white bg-accent/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href={ROUTES.LOGIN}
              className="text-gray-400 hover:text-white transition-colors text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              href={ROUTES.PLAYGROUND}
              className="btn-primary text-sm py-2 px-4"
              onClick={() => track("cta_clicked", { source: "navbar", cta: "run_demo" })}
            >
              Run demo (free)
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href || pathname?.startsWith(item.href + "/")
                      ? "text-white bg-accent/20"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-2">
                <Link href={ROUTES.LOGIN} className="btn-secondary text-center text-sm py-2">
                  Sign in
                </Link>
                <Link href={ROUTES.PLAYGROUND} className="btn-primary text-center text-sm py-2">
                  Run demo (free)
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
