import Link from 'next/link';
import type { SiteConfig } from '@/lib/site';

export function Footer({ site }: { site: SiteConfig }) {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="section-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center logo-gradient">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <span className="font-bold text-xl text-gradient">{site.brand}</span>
            </div>
            <p className="text-gray-400 text-sm max-w-2xl">
              {site.mode === 'enterprise'
                ? 'Reach OSS powers deterministic execution, while ReadyLayer extends enterprise governance, compliance workflows, and deployment controls.'
                : 'Open-source deterministic orchestration for reproducible runs with verifiable evidence.'}
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Links</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {site.footerLinks.map((link) => (
                <li key={link.href}><Link href={link.href} className="hover:text-white transition-colors">{link.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
