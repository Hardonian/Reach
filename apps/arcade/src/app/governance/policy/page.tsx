import type { Metadata } from 'next';
import Link from 'next/link';
import { CommandBlock } from '@/components/governance/CommandBlock';
import { LiveJsonPanel } from '@/components/governance/LiveJsonPanel';

export const metadata: Metadata = {
  title: 'Governance Policy Engine',
  description: 'Rule explorer for deterministic policy enforcement and gate outcomes.',
};

export default function PolicyPage() {
  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Policy Engine Explorer</h1>
        <p className="text-gray-300">Inspect policy outcomes, escalation points, and run-level deny or allow evidence.</p>
      </header>
      <LiveJsonPanel title="Recent policy-evaluated decisions" endpoint="/api/demo/decisions" />
      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="font-semibold">CLI commands</h2>
        <CommandBlock command="reach policy lint ./policies" />
        <CommandBlock command="reach run verify --policy strict-default" />
      </section>
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Read-only rule snippet</h2>
        <pre className="text-xs overflow-auto mt-2">{`package reach.gate\ndefault allow = false\nallow { input.artifact.signed == true\n        input.risk.score < 70 }`}</pre>
        <p className="mt-3 text-sm text-gray-400">Export policy traces from run evidence to satisfy audit requests.</p>
        <Link href="/docs/security" className="text-sm text-accent hover:underline">Security and policy docs</Link>
      </section>
    </div>
  );
}
