'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { track } from '@/lib/analytics';
import type { SiteConfig } from '@/lib/site';

type NavBarProps = {
  site: SiteConfig;
};

const legacyNav = [
  { href: '/playground', label: 'Playground' },
  { href: '/skills', label: 'Skills' },
  { href: '/tools', label: 'Tools' },
  { href: '/studio', label: 'Studio' },
  { href: '/templates', label: 'Templates' },
  { href: '/library', label: 'Build (Library)' },
  { href: '/reports', label: 'Run (Reports)' },
  { href: '/simulate', label: 'Simulation' },
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/settings', label: 'Manage' },
];

export function NavBar({ site }: NavBarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const primaryNav = site.mode === 'oss' || site.mode === 'enterprise' ? site.nav : legacyNav;

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border">
      <nav className="section-container">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-gradient">{site.brand}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === item.href || pathname?.startsWith(item.href + '/')
                    ? 'text-white bg-accent/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/contact" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
              Contact
            </Link>
            <Link
              href={site.mode === 'enterprise' ? '/enterprise' : '/download'}
              className="btn-primary text-sm py-2 px-4"
              onClick={() => track('cta_clicked', { source: 'navbar', cta: site.mode })}
            >
              {site.mode === 'enterprise' ? 'Enterprise roadmap' : 'Install Reach CLI'}
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/5"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-1">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href || pathname?.startsWith(item.href + '/')
                      ? 'text-white bg-accent/20'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
