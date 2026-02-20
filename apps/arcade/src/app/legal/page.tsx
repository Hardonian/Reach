import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Legal | Reach Protocol',
  description: 'Legal information, terms of service, and privacy policy for Reach.',
};

export default function LegalIndexPage() {
  const sections = [
    { title: 'Privacy Policy', href: '/legal/privacy', desc: 'How we handle your data and yours.' },
    { title: 'Terms of Service', href: '/legal/terms', desc: 'The rules for using the Reach fabric.' },
    { title: 'Cookie Policy', href: '/legal/cookies', desc: 'Information about browser data storage.' },
    { title: 'Security Reporting', href: '/security', desc: 'How to report vulnerabilities safely.' },
  ];

  return (
    <div className="section-container py-16">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-4">Legal Center</h1>
          <p className="text-gray-400">Governance and compliance information for the Reach ecosystem.</p>
        </header>

        <div className="grid gap-6">
          {sections.map((s) => (
            <Link 
              key={s.href} 
              href={s.href}
              className="group block p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-accent/50 transition-all"
            >
              <h2 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors">{s.title}</h2>
              <p className="text-gray-400 text-sm">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
