import type { Metadata } from 'next';
import { CommandBlock } from '@/components/governance/CommandBlock';
import { LiveJsonPanel } from '@/components/governance/LiveJsonPanel';

export const metadata: Metadata = {
  title: 'Governance Artifact Registry',
  description: 'Browse immutable artifacts and evidence-linked registry entries used for deterministic runs.',
};

export default function ArtifactsPage() {
  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Artifact Registry Browser</h1>
        <p className="text-gray-300">Track signed artifacts, provenance metadata, and immutable references used by governance workflows.</p>
      </header>
      <LiveJsonPanel title="Registry feed" endpoint="/api/v1/marketplace" />
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <h2 className="font-semibold">CLI commands</h2>
          <CommandBlock command="reach artifacts list --limit 20" />
          <CommandBlock command="reach artifacts show --id artifact://pack/replay-first-ci" />
        </article>
        <article className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Artifact sample</h2>
          <pre className="text-xs overflow-auto mt-2">{`{"artifact_id":"artifact://pack/replay-first-ci","digest":"sha256:...","signature":"cosign://..."}`}</pre>
        </article>
      </section>
    </div>
  );
}
