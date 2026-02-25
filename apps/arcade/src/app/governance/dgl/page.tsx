'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CommandBlock } from '@/components/governance/CommandBlock';

type DglApiResponse = {
  ok: boolean;
  data?: {
    report: {
      summary?: {
        intent_alignment_score?: number;
        semantic_drift_score?: number;
        blast_radius_score?: number;
      };
      blast_radius?: { score?: number };
      economics?: { diff_size?: number; passes_to_converge?: number; repair_cycles?: number };
      drift_forecast_score?: number;
    } | null;
    provider_matrix: Array<{ provider: string; model: string; pass_rate: number; calibration_score: number }>;
    violations: Array<{ type: string; severity: string; paths: string[]; line?: number }>;
    turbulence_hotspots: Array<{ path: string; reason: string; count: number }>;
  };
  error?: { message?: string };
};

export default function DglGovernancePage() {
  const [query, setQuery] = useState({ branch: '', provider: '', subsystem: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DglApiResponse['data']>();

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (query.branch) params.set('branch', query.branch);
    if (query.provider) params.set('provider', query.provider);
    if (query.subsystem) params.set('subsystem', query.subsystem);
    return params.toString();
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/governance/dgl${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
        const json = (await res.json()) as DglApiResponse;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error?.message ?? 'Failed to load divergence governance data.');
          setData(undefined);
          return;
        }
        setData(json.data);
      } catch {
        if (!cancelled) setError('Governance endpoint unavailable. Use CLI exports below.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Divergence Governance Layer (DGL)</h1>
        <p className="text-gray-300">Investigate semantic drift, blast radius, and trust-boundary violations before changes are accepted.</p>
      </header>

      <section className="grid md:grid-cols-3 gap-3">
        {(['branch', 'provider', 'subsystem'] as const).map((key) => (
          <input key={key} className="px-3 py-2 rounded border border-border bg-surface" placeholder={`Filter ${key}`} value={query[key]} onChange={(e) => setQuery((v) => ({ ...v, [key]: e.target.value }))} />
        ))}
      </section>

      {loading && <div className="rounded-xl border border-border bg-surface p-4">Loading divergence telemetry…</div>}
      {!loading && error && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">{error}</div>}
      {!loading && !error && !data?.report && <div className="rounded-xl border border-border bg-surface p-4">No DGL report matched this filter.</div>}

      {!loading && !error && data?.report && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Intent alignment</p><p className="text-2xl font-semibold">{data.report.summary?.intent_alignment_score ?? 0}</p></article>
            <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Semantic drift</p><p className="text-2xl font-semibold">{data.report.summary?.semantic_drift_score ?? 0}</p></article>
            <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Blast radius</p><p className="text-2xl font-semibold">{data.report.blast_radius?.score ?? data.report.summary?.blast_radius_score ?? 0}</p></article>
            <article className="rounded-xl border border-border bg-surface p-4"><p className="text-sm text-gray-400">Drift forecast</p><p className="text-2xl font-semibold">{Math.round((data.report.drift_forecast_score ?? 0) * 100)}%</p></article>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 overflow-auto">
            <h2 className="font-semibold mb-2">Violation explorer</h2>
            {data.violations.length === 0 ? <p className="text-sm text-gray-400">No violations detected.</p> : (
              <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-border"><th className="py-2">Type</th><th>Severity</th><th>Paths</th></tr></thead><tbody>{data.violations.map((v, idx) => <tr key={`${v.type}-${idx}`} className="border-b border-border/60"><td className="py-2">{v.type}</td><td>{v.severity}</td><td>{v.paths.join(', ')}</td></tr>)}</tbody></table>
            )}
          </section>
        </>
      )}

      <section className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <h2 className="font-semibold">Commands and exports</h2>
        <CommandBlock command="npm run reach:dgl:scan" />
        <CommandBlock command="npm run reach:dgl:report" />
        <CommandBlock command="npm run reach:dgl:economics" />
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold mb-2">Spec links</h2>
        <ul className="text-sm text-accent space-y-1">
          <li><a href="https://github.com/reach-sh/reach/blob/main/VERIFY_DGL.md" className="hover:underline">DGL verification guide</a></li>
          <li><Link href="/governance/providers" className="hover:underline">Provider matrix</Link></li>
        </ul>
      </section>
    </div>
  );
}
