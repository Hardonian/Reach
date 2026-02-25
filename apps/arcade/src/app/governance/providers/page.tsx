import type { Metadata } from 'next';
import { CommandBlock } from '@/components/governance/CommandBlock';
import { LiveJsonPanel } from '@/components/governance/LiveJsonPanel';

export const metadata: Metadata = {
  title: 'Governance Provider Matrix',
  description: 'Provider capability and trust-boundary matrix for governed execution.',
};

const providers = [
  { name: 'OpenAI', arbitration: 'Supported', policy: 'Supported', deterministicReplay: 'Supported' },
  { name: 'Anthropic', arbitration: 'Supported', policy: 'Supported', deterministicReplay: 'Supported' },
  { name: 'Azure OpenAI', arbitration: 'Supported', policy: 'Supported', deterministicReplay: 'Supported' },
  { name: 'Local OSS model', arbitration: 'Supported', policy: 'Supported', deterministicReplay: 'Supported' },
];

export default function ProvidersPage() {
  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Provider Capability Matrix</h1>
        <p className="text-gray-300">Compare provider readiness across arbitration, policy enforcement, and replay-grade evidence capture.</p>
      </header>
      <LiveJsonPanel title="Provider telemetry snapshot" endpoint="/api/governance/dgl" />
      <section className="rounded-xl border border-border bg-surface p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 border-b border-border"><th className="py-2">Provider</th><th>CPX arbitration</th><th>Policy gate</th><th>Replay evidence</th></tr></thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.name} className="border-b border-border/60"><td className="py-2">{provider.name}</td><td>{provider.arbitration}</td><td>{provider.policy}</td><td>{provider.deterministicReplay}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <CommandBlock command="reach providers matrix --format json" />
    </div>
  );
}
