'use client';

import { useEffect, useMemo, useState } from 'react';

type CpxRun = { id: string; timestamp: string; base_sha: string; decision_type: string };

type CpxRunResponse = {
  ok: boolean;
  data?: { items: CpxRun[]; total: number; page: number; limit: number };
  error?: { message?: string };
};

export default function CpxGovernancePage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [runs, setRuns] = useState<CpxRun[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string>('');
  const [runData, setRunData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  useEffect(() => {
    let cancelled = false;
    async function loadRuns() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/cpx/runs?page=${page}&limit=${limit}`, { cache: 'no-store' });
        const json = (await res.json()) as CpxRunResponse;
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error?.message ?? 'Unable to load CPX runs');
        setRuns(json.data?.items ?? []);
        setTotal(json.data?.total ?? 0);
        if (!selected && (json.data?.items?.length ?? 0) > 0) setSelected(json.data?.items?.[0]?.id ?? '');
      } catch {
        if (!cancelled) setError('Unable to load CPX runs.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [page, limit, selected]);

  useEffect(() => {
    if (!selected) {
      setRunData(null);
      return;
    }
    let cancelled = false;
    async function loadRun() {
      try {
        const res = await fetch(`/api/cpx/runs/${selected}`, { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; data?: Record<string, unknown> | null };
        if (!cancelled) setRunData(json.data ?? null);
      } catch {
        if (!cancelled) setRunData(null);
      }
    }
    void loadRun();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div className="section-container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Counterfactual Patch Arbitration</h1>
        <p className="text-gray-400">Compare candidate patches and review deterministic arbitration outcomes.</p>
      </div>
      {loading && <div className="rounded-lg border border-border p-4 bg-surface">Loading CPX runs…</div>}
      {!loading && error && <div className="rounded-lg border border-red-500 p-4 bg-surface text-red-300">{error}</div>}
      {!loading && !error && runs.length === 0 && <div className="rounded-lg border border-border p-4 bg-surface">No CPX runs found yet.</div>}
      {!loading && !error && runs.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <section className="rounded-lg border border-border p-4 bg-surface md:col-span-1 space-y-3">
            <h2 className="font-semibold">Runs</h2>
            {runs.map((run) => (
              <button key={run.id} className={`w-full text-left rounded border px-3 py-2 ${selected === run.id ? 'border-blue-500' : 'border-border'}`} onClick={() => setSelected(run.id)}>
                <p className="font-medium">{run.id}</p>
                <p className="text-xs text-gray-400">{run.decision_type}</p>
              </button>
            ))}
            <div className="flex items-center justify-between text-sm">
              <button className="px-2 py-1 border border-border rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span>{page}/{pages}</span>
              <button className="px-2 py-1 border border-border rounded disabled:opacity-50" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</button>
            </div>
          </section>
          <section className="rounded-lg border border-border p-4 bg-surface md:col-span-2">
            {!runData ? (
              <p className="text-gray-400">Select a run to compare candidates.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded border border-border p-3">
                  <p className="text-sm text-gray-400">Arbitration decision</p>
                  <p className="text-xl font-semibold">{String((runData.arbitration as Record<string, unknown> | undefined)?.decision_type ?? 'UNKNOWN')}</p>
                </div>
                <div className="rounded border border-border p-3">
                  <p className="font-medium mb-2">Candidate scores</p>
                  <pre className="text-xs overflow-auto">{JSON.stringify(runData.per_patch ?? [], null, 2)}</pre>
                </div>
                <div className="rounded border border-border p-3">
                  <p className="font-medium mb-2">Conflict summary</p>
                  <pre className="text-xs overflow-auto">{JSON.stringify(runData.conflict_matrix ?? {}, null, 2)}</pre>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
