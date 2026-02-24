'use client';

import { useEffect, useMemo, useState } from 'react';

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
      turbulence_hotspots?: Array<{ path: string; reason: string; count: number }>;
    } | null;
    provider_matrix: Array<{ provider: string; model: string; pass_rate: number; calibration_score: number; revert_ratio?: number; trust_boundary_touch_rate?: number }>;
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
  const [sortBy, setSortBy] = useState<'pass_rate' | 'calibration_score'>('pass_rate');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    if (provider) params.set('provider', provider);
    if (subsystem) params.set('subsystem', subsystem);
    return params.toString();
  }, [branch, provider, subsystem]);

  const sortedProviderMatrix = useMemo(() => [...(data?.provider_matrix ?? [])].sort((a, b) => (Number(b[sortBy] ?? 0) - Number(a[sortBy] ?? 0))), [data?.provider_matrix, sortBy]);

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

          <section className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border p-4 bg-surface">
              <p className="text-sm text-gray-400">Blast Radius</p>
              <p className="text-3xl font-semibold">{data.report.blast_radius?.score ?? data.report.summary?.blast_radius_score ?? 0}</p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-surface">
              <p className="text-sm text-gray-400">Drift Forecast</p>
              <p className="text-3xl font-semibold">{Math.round((data.report.drift_forecast_score ?? 0) * 100)}%</p>
            </div>
            <div className="rounded-lg border border-border p-4 bg-surface">
              <p className="text-sm text-gray-400">Economic Diff Size</p>
              <p className="text-3xl font-semibold">{data.report.economics?.diff_size ?? 0}</p>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4 bg-surface">
            <h2 className="text-lg font-semibold mb-3">Provider Drift Matrix</h2>
            <div className="mb-3 flex items-center gap-2 text-sm"><label htmlFor="provider-sort" className="text-gray-400">Sort by</label><select id="provider-sort" className="px-2 py-1 rounded border border-border bg-surface" value={sortBy} onChange={(e) => setSortBy(e.target.value as "pass_rate" | "calibration_score")}><option value="pass_rate">Pass rate</option><option value="calibration_score">Calibration</option></select></div>{data.provider_matrix.length === 0 ? (
              <p className="text-gray-400">No provider telemetry found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-border">
                    <th className="py-2">Provider</th><th>Model</th><th>CI Pass</th><th>Calibration</th><th>Revert</th><th>Trust Touch</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProviderMatrix.map((p) => (
                    <tr key={`${p.provider}-${p.model}`} className="border-b border-border/50">
                      <td className="py-2">{p.provider}</td><td>{p.model}</td><td>{Math.round((p.pass_rate ?? 0) * 100)}%</td><td>{(p.calibration_score ?? 0).toFixed(2)}</td><td>{Math.round((p.revert_ratio ?? 0) * 100)}%</td><td>{Math.round((p.trust_boundary_touch_rate ?? 0) * 100)}%</td>
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
