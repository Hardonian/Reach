import type { Metadata } from 'next';
import Link from 'next/link';
import { CommandBlock } from '@/components/governance/CommandBlock';
import { LiveJsonPanel } from '@/components/governance/LiveJsonPanel';

export const metadata: Metadata = {
  title: 'Governance Determinism Replay',
  description: 'Audit-grade replay visibility for deterministic runs and fingerprint verification.',
};

export default function DeterminismPage() {
  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Determinism Replay</h1>
        <p className="text-gray-300">Validate that identical inputs, policies, and artifacts produce identical fingerprints in every run.</p>
      </header>

      <LiveJsonPanel title="Replay status feed" endpoint="/api/demo/replay" />

      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="font-semibold">CLI commands</h2>
        <CommandBlock command="reachctl verify-determinism --n=5" />
        <CommandBlock command="reach run replay --run <run-id> --export evidence.json" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface p-4">
          <h3 className="font-semibold">Artifact example</h3>
          <p className="text-sm text-gray-400">Replay capsule with event log, policy digest, and output fingerprint.</p>
          <pre className="text-xs mt-2 overflow-auto">{`{"run_id":"run_2048","fingerprint":"sha256:...","capsule":"capsule://run_2048"}`}</pre>
        </article>
        <article className="rounded-xl border border-border bg-surface p-4">
          <h3 className="font-semibold">Spec links</h3>
          <ul className="text-sm text-accent space-y-1">
            <li><Link href="/docs/governance">Governance docs</Link></li>
            <li><a href="https://github.com/reach-sh/reach/blob/main/docs/DETERMINISM_SPEC.md" className="hover:underline">Determinism specification</a></li>
          </ul>
        </article>
      </section>
    </div>
  );
}
