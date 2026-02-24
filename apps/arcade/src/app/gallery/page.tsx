import Link from 'next/link';

const packs = [
  { slug: 'security-basics', path: '/packs/security-basics', summary: 'Baseline checks for policy, provenance, and drift.' },
  { slug: 'replay-first-ci', path: '/packs/replay-first-ci', summary: 'CI profile focused on reproducible replay verification.' },
  { slug: 'audit-evidence-capture', path: '/packs/audit-evidence-capture', summary: 'Captures run evidence artifacts for audits.' },
];

export default function GalleryPage() {
  return (
    <div className="section-container py-16">
      <h1 className="text-4xl font-bold mb-6">Pack gallery</h1>
      <p className="text-gray-400 mb-8">Read-only index of pack examples present in this repository.</p>
      <div className="space-y-4">
        {packs.map((pack) => (
          <article className="card p-6" key={pack.slug}>
            <h2 className="text-xl font-semibold">{pack.slug}</h2>
            <p className="text-gray-400 text-sm mb-2">{pack.summary}</p>
            <Link className="text-accent hover:underline" href={pack.path}>View source path</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
