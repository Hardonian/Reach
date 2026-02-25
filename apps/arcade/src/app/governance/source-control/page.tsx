'use client';

import { useEffect, useState } from 'react';
import { CommandBlock } from '@/components/governance/CommandBlock';

type ApiPayload = {
  ok: boolean;
  data?: {
    state?: { repo_root: string; upstream_head: string; local_head: string; stale_base: boolean; dirty: boolean };
    plan?: { action: string; reasons: string[] };
    items?: Array<Record<string, unknown>>;
    page?: number;
    totalPages?: number;
  };
  error?: { message?: string };
};

export default function SourceControlGovernancePage() {
  const [status, setStatus] = useState<ApiPayload>();
  const [runs, setRuns] = useState<ApiPayload>();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const headers = { 'x-reach-auth': 'demo' };
      try {
        const [statusRes, runsRes] = await Promise.all([
          fetch('/api/sccl/status', { headers, cache: 'no-store' }),
          fetch(`/api/sccl/runs?page=${page}&pageSize=10`, { headers, cache: 'no-store' }),
        ]);
        const statusJson = (await statusRes.json()) as ApiPayload;
        const runsJson = (await runsRes.json()) as ApiPayload;
        if (cancelled) return;
        setStatus(statusJson);
        setRuns(runsJson);
      } catch {
        if (!cancelled) {
          setStatus({ ok: false, error: { message: 'SCCL status endpoint unavailable.' } });
          setRuns({ ok: false, error: { message: 'SCCL run feed unavailable.' } });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="section-container py-8 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Source Control Coherence Layer (SCCL)</h1>
        <p className="text-gray-300">Detect drift, lease contention, and stale-base conditions across CLI, dashboard, and automation pipelines.</p>
      </header>

      {loading && <div className="rounded-xl border border-border bg-surface p-4">Loading SCCL state…</div>}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold mb-2">Sync state visualizer</h2>
        {!status?.ok ? <p className="text-amber-200">{status?.error?.message ?? 'Status unavailable.'}</p> : (
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <p><span className="text-gray-400">Repo:</span> {status.data?.state?.repo_root}</p>
            <p><span className="text-gray-400">Sync action:</span> {status.data?.plan?.action}</p>
            <p><span className="text-gray-400">Upstream head:</span> {status.data?.state?.upstream_head?.slice(0, 12)}</p>
            <p><span className="text-gray-400">Local head:</span> {status.data?.state?.local_head?.slice(0, 12)}</p>
            <p><span className="text-gray-400">Stale base:</span> {String(status.data?.state?.stale_base)}</p>
            <p><span className="text-gray-400">Dirty tree:</span> {String(status.data?.state?.dirty)}</p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold mb-2">Run records</h2>
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
              <span>Page {runs.data?.page ?? page} of {runs.data?.totalPages ?? page}</span>
              <button className="px-3 py-1 border border-border rounded" onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </>
        ) : <p className="text-gray-400">No run records available.</p>}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <h2 className="font-semibold">Commands and exports</h2>
        <CommandBlock command="reach sync status" />
        <CommandBlock command="reach sync lease list" />
        <CommandBlock command="reach sync apply --pack <pack>" />
      </section>
    </div>
  );
}
