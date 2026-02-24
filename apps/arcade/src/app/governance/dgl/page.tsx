'use client';

import { useEffect, useMemo, useState } from 'react';

type DglApiResponse = {
  ok: boolean;
  data?: {
    report: {
      summary?: {
        intent_alignment_score?: number;
        semantic_drift_score?: number;
      };
      turbulence_hotspots?: Array<{ path: string; reason: string; count: number }>;
    } | null;
    provider_matrix: Array<{ provider: string; model: string; pass_rate: number; calibration_score: number }>;
    violations: Array<{ type: string; severity: string; paths: string[]; line?: number }>;
    turbulence_hotspots: Array<{ path: string; reason: string; count: number }>;
  };
  error?: { message?: string };
};

export default function DglGovernancePage() {
  const [branch, setBranch] = useState('');
  const [provider, setProvider] = useState('');
  const [subsystem, setSubsystem] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<DglApiResponse['data']>();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (provider) params.set('provider', provider);
    if (subsystem) params.set('subsystem', subsystem);
    return params.toString();
  }, [branch, provider, subsystem]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/governance/dgl${query ? `?${query}` : ''}`, { cache: 'no-store' });
        const json = (await res.json()) as DglApiResponse;
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error?.message ?? 'Failed to load governance data.');
          setData(undefined);
        } else {
          setData(json.data);
        }
      } catch {
        if (!cancelled) {
          setError('Network error while loading governance data.');
          setData(undefined);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="section-container py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Divergence Governance</h1>
        <p className="text-gray-400">Track semantic alignment risk, provider calibration, and turbulence hotspots.</p>
      </div>

      <section className="grid md:grid-cols-3 gap-3">
        <input className="px-3 py-2 rounded border border-border bg-surface" placeholder="Filter branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <input className="px-3 py-2 rounded border border-border bg-surface" placeholder="Filter provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
        <input className="px-3 py-2 rounded border border-border bg-surface" placeholder="Filter subsystem" value={subsystem} onChange={(e) => setSubsystem(e.target.value)} />
      </section>

      {loading && <div className="rounded-lg border border-border p-4 bg-surface">Loading divergence governance data…</div>}
      {!loading && error && <div className="rounded-lg border border-red-500 p-4 bg-surface text-red-300">{error}</div>}

      {!loading && !error && !data?.report && (
        <div className="rounded-lg border border-border p-4 bg-surface">No DGL report available for the selected filters.</div>
      )}

      {!loading && !error && data?.report && (
        <>
          <section className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4 bg-surface">
              <p className="text-sm text-gray-400">Intent Alignment</p>
              <p className="text-3xl font-semibold">{data.report.summary?.intent_alignment_score ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-surface">
              <p className="text-sm text-gray-400">Semantic Drift</p>
              <p className="text-3xl font-semibold">{data.report.summary?.semantic_drift_score ?? 0}</p>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4 bg-surface">
            <h2 className="text-lg font-semibold mb-3">Provider Drift Matrix</h2>
            {data.provider_matrix.length === 0 ? (
              <p className="text-gray-400">No provider telemetry found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-border">
                    <th className="py-2">Provider</th><th>Model</th><th>CI Pass</th><th>Calibration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.provider_matrix.map((p) => (
                    <tr key={`${p.provider}-${p.model}`} className="border-b border-border/50">
                      <td className="py-2">{p.provider}</td><td>{p.model}</td><td>{Math.round((p.pass_rate ?? 0) * 100)}%</td><td>{(p.calibration_score ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>


          <section className="rounded-lg border border-border p-4 bg-surface">
            <h2 className="text-lg font-semibold mb-3">Recent Violations</h2>
            {data.violations.length === 0 ? (
              <p className="text-gray-400">No violations for selected filters.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-border">
                    <th className="py-2">Severity</th><th>Type</th><th>Path</th><th>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {data.violations.map((v, i) => (
                    <tr key={`${v.type}-${i}`} className="border-b border-border/50">
                      <td className="py-2">{v.severity}</td><td>{v.type}</td><td>{v.paths?.[0] ?? '-'}</td><td>{v.line ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-lg border border-border p-4 bg-surface">
            <h2 className="text-lg font-semibold mb-3">Turbulence Map</h2>
            {data.turbulence_hotspots.length === 0 ? (
              <p className="text-gray-400">No turbulence hotspots recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-border">
                    <th className="py-2">Path</th><th>Reason</th><th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.turbulence_hotspots.map((h) => (
                    <tr key={`${h.path}-${h.reason}`} className="border-b border-border/50">
                      <td className="py-2">{h.path}</td><td>{h.reason}</td><td>{h.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

        </>
      )}
    </div>
  );
}
