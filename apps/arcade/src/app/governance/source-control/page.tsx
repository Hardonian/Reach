'use client';

import { useEffect, useState } from 'react';

type ApiPayload = {
  ok: boolean;
  data?: {
    state?: { repo_root: string; upstream_head: string; local_head: string; stale_base: boolean; dirty: boolean };
    plan?: { action: string; reasons: string[] };
    required_gates?: string[];
    items?: Array<Record<string, unknown>>;
    total?: number;
    page?: number;
    totalPages?: number;
  };
  error?: { message?: string };
};

export default function SourceControlGovernancePage() {
  const [status, setStatus] = useState<ApiPayload>();
  const [runs, setRuns] = useState<ApiPayload>();
  const [page, setPage] = useState(1);

  useEffect(() => {
    const headers = { 'x-reach-auth': 'demo' };
    void fetch('/api/sccl/status', { headers, cache: 'no-store' }).then((r) => r.json()).then((d: ApiPayload) => setStatus(d));
  }, []);

  useEffect(() => {
    const headers = { 'x-reach-auth': 'demo' };
    void fetch(`/api/sccl/runs?page=${page}&pageSize=10`, { headers, cache: 'no-store' }).then((r) => r.json()).then((d: ApiPayload) => setRuns(d));
  }, [page]);

  return (
    <div className="section-container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Source Control Coherence</h1>
        <p className="text-gray-400">Single-source sync state across CLI, web console, backend services, and agents.</p>
      </div>

      <section className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-lg font-semibold mb-2">Repo Status</h2>
        {!status?.ok ? <p className="text-red-300">{status?.error?.message ?? 'Status unavailable.'}</p> : (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <p><span className="text-gray-400">Repo:</span> {status.data?.state?.repo_root}</p>
            <p><span className="text-gray-400">Sync Action:</span> {status.data?.plan?.action}</p>
            <p><span className="text-gray-400">Upstream Head:</span> {status.data?.state?.upstream_head?.slice(0, 12)}</p>
            <p><span className="text-gray-400">Local Head:</span> {status.data?.state?.local_head?.slice(0, 12)}</p>
            <p><span className="text-gray-400">Stale Base:</span> {String(status.data?.state?.stale_base)}</p>
            <p><span className="text-gray-400">Dirty Tree:</span> {String(status.data?.state?.dirty)}</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-lg font-semibold mb-2">Active Leases</h2>
        <p className="text-sm text-gray-400">Use <code>reach sync lease list</code> for lease ownership and TTL details.</p>
      </section>

      <section className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-lg font-semibold mb-2">Recent Sync Events</h2>
        {runs?.ok ? (
          <>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 border-b border-border"><th className="py-2">Run</th><th>Base</th><th>Head</th><th>Actor</th></tr></thead>
              <tbody>
                {(runs.data?.items ?? []).map((row) => (
                  <tr key={String(row.run_id)} className="border-b border-border/50"><td className="py-2">{String(row.run_id)}</td><td>{String(row.base_sha ?? '').slice(0, 10)}</td><td>{String(row.head_sha ?? '').slice(0, 10)}</td><td>{String((row.actor as { user_id?: string } | undefined)?.user_id ?? 'unknown')}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <button className="px-3 py-1 border border-border rounded" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span>Page {runs.data?.page} of {runs.data?.totalPages}</span>
              <button className="px-3 py-1 border border-border rounded" onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </>
        ) : <p className="text-gray-400">No sync events yet.</p>}
      </section>

      <section className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-lg font-semibold mb-2">Split-Brain Alerts</h2>
        <ul className="list-disc pl-5 text-sm text-gray-300">
          <li>Stale base patches</li>
          <li>Missing run records</li>
          <li>Mismatched context hashes</li>
        </ul>
      </section>

      <section className="rounded-lg border border-border p-4 bg-surface">
        <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
        <ul className="text-sm space-y-1">
          <li><code>reach sync status</code></li>
          <li><code>reach sync up</code></li>
          <li><code>reach sync apply --pack &lt;pack&gt;</code></li>
          <li><a href="/governance/dgl" className="text-accent hover:underline">Open DGL dashboard</a></li>
          <li><a href="/governance/cpx" className="text-accent hover:underline">Open CPX dashboard</a></li>
        </ul>
      </section>
    </div>
  );
}
