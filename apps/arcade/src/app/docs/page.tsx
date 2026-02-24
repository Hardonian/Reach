import Link from 'next/link';

const docsLinks = [
  { href: '/docs/getting-started', title: 'Getting started' },
  { href: '/docs/architecture', title: 'Architecture' },
  { href: '/docs/security', title: 'Security docs' },
  { href: '/docs/cli', title: 'CLI reference' },
  { href: 'https://github.com/reach-sh/reach/tree/main/docs/spec', title: 'Specs (repository)' },
  { href: 'https://github.com/reach-sh/reach/blob/main/docs/EVIDENCE_CHAIN_MODEL.md', title: 'Evidence chain model' },
];

export default function DocsPage() {
  return (
    <div className="section-container py-12">
      <h1 className="text-4xl font-bold mb-4">Documentation</h1>
      <p className="text-gray-400 mb-8">Key docs and specifications for deterministic runs, verification, and replay workflows.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {docsLinks.map((link) => (
          <Link key={link.href} href={link.href} className="card p-6 hover:border-accent/40 transition-colors">{link.title}</Link>
        ))}
      </div>
    </div>
  );
}
