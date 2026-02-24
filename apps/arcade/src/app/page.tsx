import Link from 'next/link';
import { getSiteConfig } from '@/lib/site';

export default async function Home() {
  const site = await getSiteConfig();

  if (site.mode === 'enterprise') {
    return (
      <div className="section-container py-16 space-y-10">
        <section className="card p-10">
          <h1 className="text-5xl font-bold mb-4">Governance for deterministic agent systems</h1>
          <p className="text-gray-300 text-lg">
            ReadyLayer is the enterprise roadmap and beta program built on the Reach OSS engine.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            Available now: architecture reviews, pilot planning, and OSS deployment support. Roadmap: policy packs,
            enterprise identity integration, and managed control-plane workflows.
          </p>
          <div className="mt-6 flex gap-3">
            <Link className="btn-primary" href="/enterprise">See enterprise roadmap</Link>
            <Link className="btn-secondary" href="/contact">Contact team</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="section-container py-16 space-y-10">
      <section className="card p-10">
        <h1 className="text-5xl font-bold mb-4">Deterministic event orchestration in OSS</h1>
        <p className="text-gray-300 text-lg mb-6">
          Reach CLI helps teams run, verify, and replay execution with consistent fingerprints.
        </p>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <Link href="/docs" className="btn-secondary">Docs</Link>
          <Link href="/download" className="btn-secondary">Download</Link>
          <Link href="/gallery" className="btn-secondary">Gallery</Link>
          <Link href="/security" className="btn-secondary">Security</Link>
          <Link href="/whitepaper" className="btn-secondary">Whitepaper</Link>
          <Link href="/roadmap" className="btn-secondary">Roadmap</Link>
        </div>
      </section>
      <section className="card p-10">
        <h2 className="text-2xl font-bold mb-3">Install in ~60 seconds</h2>
        <pre className="bg-black/40 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -fsSL https://reach-cli.com/install.sh | sh
reachctl run --pack packs/security-basics
reachctl verify --run <id>
reachctl replay --run <id>`}
        </pre>
      </section>
    </div>
  );
}
