import type { Metadata } from 'next';
import { CommandBlock } from '@/components/governance/CommandBlock';
import { LiveJsonPanel } from '@/components/governance/LiveJsonPanel';

export const metadata: Metadata = {
  title: 'Governance Economics',
  description: 'Economics telemetry for cost per accepted patch, provider spend, and convergence velocity.',
};

export default function EconomicsPage() {
  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Economics Telemetry</h1>
        <p className="text-gray-300">Measure efficiency, convergence, and provider spend for deterministic CI governance programs.</p>
      </header>
      <LiveJsonPanel title="Economics stream" endpoint="/api/demo/status" />
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Cost per accepted patch</p><p className="text-2xl font-semibold">$2.13</p></article>
        <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Median convergence pass</p><p className="text-2xl font-semibold">2.1</p></article>
        <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Policy deny rate</p><p className="text-2xl font-semibold">6.8%</p></article>
      </section>
      <section className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <h2 className="font-semibold">CLI commands</h2>
        <CommandBlock command="npm run reach:dgl:economics" />
        <CommandBlock command="reach run economics --window 24h --export csv" />
      </section>
    </div>
  );
}
