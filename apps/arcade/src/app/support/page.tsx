import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support Center | Reach',
  description: 'Get help with Reach. Explore self-service docs, contact support, or check system status.',
};

export default function SupportPage() {
  const supportTiers = [
    {
      name: 'Community Support',
      description: 'Ideal for developers and hobbyists. Best-effort support via GitHub and Discord.',
      features: ['GitHub Discussions', 'Community Discord', 'Public Documentation', 'Open Bug Reports'],
      cta: 'Join Community',
      href: 'https://github.com',
    },
    {
      name: 'Professional Support',
      description: 'Standard support for scaling teams. Guaranteed response times for critical issues.',
      features: ['Email Support', '8/5 Availability', '24h Response Time', 'Basic SLA'],
      cta: 'Contact Sales',
      href: '/contact',
      highlighted: true,
    },
    {
      name: 'Enterprise Support',
      description: 'Mission-critical support with dedicated engineers and 24/7 availability.',
      features: ['Dedicated Slack/Teams', '24/7 Availability', '4h Critical Response', 'Full Uptime SLA'],
      cta: 'Upgrade Now',
      href: '/contact',
    },
  ];

  return (
    <div className="section-container py-16">
      <div className="max-w-5xl mx-auto">
        <header className="mb-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Support Center</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Choose the right level of support for your team. From self-service documentation 
            to dedicated enterprise engineering.
          </p>
        </header>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 text-center">
          <Link href="/docs" className="card p-8 border border-white/5 rounded-2xl hover:bg-white/5 transition-colors">
            <span className="text-3xl mb-4 block">📖</span>
            <h3 className="font-bold mb-1">Documentation</h3>
            <p className="text-xs text-gray-500">Read the manual</p>
          </Link>
          <Link href="/faq" className="card p-8 border border-white/5 rounded-2xl hover:bg-white/5 transition-colors">
            <span className="text-3xl mb-4 block">❓</span>
            <h3 className="font-bold mb-1">FAQ</h3>
            <p className="text-xs text-gray-500">Quick answers</p>
          </Link>
          <Link href="/support/status" className="card p-8 border border-white/5 rounded-2xl hover:bg-white/5 transition-colors">
            <span className="text-3xl mb-4 block">🟢</span>
            <h3 className="font-bold mb-1">System Status</h3>
            <p className="text-xs text-gray-500">All systems go</p>
          </Link>
        </div>

        {/* Support Tiers */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {supportTiers.map((tier) => (
            <div 
              key={tier.name}
              className={`flex flex-col p-8 rounded-3xl border ${tier.highlighted ? 'border-accent/40 bg-accent/5' : 'border-white/5 bg-white/[0.02]'}`}
            >
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <p className="text-sm text-gray-500 mb-8">{tier.description}</p>
              
              <ul className="space-y-4 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="text-accent text-lg">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link 
                href={tier.href}
                className={tier.highlighted ? 'btn-primary text-center py-3' : 'btn-secondary text-center py-3'}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Bug Reporting */}
        <div className="mt-20 p-12 bg-white/5 rounded-3xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-bold mb-2 text-white">Found a bug?</h2>
            <p className="text-gray-400 text-sm max-w-sm">
              Our engineering team tracks all issues on GitHub. Help us improve the 
              deterministic engine by reporting bugs and edge cases.
            </p>
          </div>
          <Link href="https://github.com" className="btn-secondary py-3 px-8 whitespace-nowrap">
            Report Issue on GitHub
          </Link>
        </div>
      </div>
    </div>
  );
}
