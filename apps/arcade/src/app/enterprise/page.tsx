import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Enterprise Governance OS',
  description: 'Enterprise governance for deterministic AI development: policy enforcement, replay-grade auditability, and multi-provider arbitration.',
  openGraph: {
    title: 'Reach Enterprise Governance OS',
    description: 'Deterministic CI for AI agents with audit-grade replay, tenant isolation, and policy controls.',
    url: 'https://reach-cli.com/enterprise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reach Enterprise Governance OS',
    description: 'Deterministic CI for AI agents with policy and arbitration controls.',
  },
};

const sections = [
  {
    title: 'Enterprise Overview',
    body: 'Reach Enterprise provides a governance operating system for AI delivery teams that need deterministic outcomes, explainable policy gates, and reproducible run evidence in every release cycle.',
  },
  {
    title: 'Security & Compliance',
    body: 'Audit-grade replay, signed artifacts, policy trace retention, and tenant-scoped controls support SOC 2, internal controls, and regulated deployment programs without changing developer ergonomics.',
  },
  {
    title: 'Architecture',
    body: 'Governance planes include Determinism Replay, DGL for divergence control, CPX for patch arbitration, SCCL for source coherence, Policy Engine rules, and evidence chain exports.',
  },
  {
    title: 'Deployment Options',
    body: 'Deploy in cloud-managed, on-prem, or hybrid mode with Git-native integration, private networking options, and isolated tenant boundaries for execution and evidence storage.',
  },
  {
    title: 'Policy Controls',
    body: 'Define controls for residency, provider routing, trust boundaries, and change-risk thresholds. Policies evaluate continuously and can block non-compliant patches before merge.',
  },
  {
    title: 'Integrations',
    body: 'Integrates with GitHub, GitLab, existing CI systems, artifact registries, and model providers through a provider SDK that preserves deterministic replay and governance metadata.',
  },
];

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Reach Enterprise Governance OS',
  description: 'Deterministic CI for AI agents with multi-provider arbitration, policy enforcement, and replay-grade auditability.',
  brand: 'Reach',
  url: 'https://reach-cli.com/enterprise',
};

export default function EnterprisePage() {
  return (
    <div className="section-container py-12 space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="space-y-4">
        <h1 className="text-4xl font-bold">Enterprise Governance OS for Deterministic AI Delivery</h1>
        <p className="text-gray-300 max-w-3xl">Run deterministic CI for AI agents with governance controls that scale across providers, teams, and compliance obligations.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/enterprise/request-demo?source=primary" className="btn-primary" prefetch={false}>Request demo</Link>
          <Link href="/governance" className="btn-secondary">Explore governance console</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-xl border border-border bg-surface p-5">
            <h2 className="text-xl font-semibold">{section.title}</h2>
            <p className="mt-2 text-gray-300">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-xl font-semibold">Request Demo</h2>
        <p className="text-gray-300 mt-2">Connect with the Reach team for architecture review, deployment planning, and governance rollout guidance.</p>
        <Link href="/enterprise/request-demo?source=footer" className="mt-4 inline-flex rounded-lg border border-border px-4 py-2 hover:bg-white/5 transition-colors" prefetch={false}>Go to ready-layer.com</Link>
      </section>
    </div>
  );
}
