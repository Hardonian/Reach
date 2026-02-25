'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CommandBlock } from '@/components/governance/CommandBlock';

type CpxRun = { id: string; timestamp: string; base_sha: string; decision_type: string };

type CpxRunResponse = {
  ok: boolean;
  data?: { items: CpxRun[]; total: number; page: number; limit: number };
  error?: { message?: string };
};

export default function CpxGovernancePage() {
  const [page, setPage] = useState(1);
  const limit = 8;
  const [runs, setRuns] = useState<CpxRun[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState('');
  const [runData, setRunData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total]);

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
        const nextRuns = json.data?.items ?? [];
        setRuns(nextRuns);
        setTotal(json.data?.total ?? 0);
        setSelected((current) => current || nextRuns[0]?.id || '');
      } catch {
        if (!cancelled) setError('CPX run feed unavailable. Use command-line report export while service recovers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [page]);

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
      <header>
        <h1 className="text-3xl font-bold">Counterfactual Patch Exchange (CPX)</h1>
        <p className="text-gray-300">Compare patches across providers, inspect arbitration conflicts, and document the final accepted trajectory.</p>
      </header>

      {loading && <div className="rounded-xl border border-border bg-surface p-4">Loading CPX runs…</div>}
      {!loading && error && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100">{error}</div>}
      {!loading && !error && runs.length === 0 && <div className="rounded-xl border border-border bg-surface p-4">No CPX runs found for this window.</div>}

      {!loading && !error && runs.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          <section className="rounded-xl border border-border bg-surface p-4 md:col-span-1 space-y-3">
            <h2 className="font-semibold">Comparison runs</h2>
            {runs.map((run) => (
              <button key={run.id} className={`w-full text-left rounded border px-3 py-2 transition-colors ${selected === run.id ? 'border-accent bg-accent/10' : 'border-border hover:bg-white/5'}`} onClick={() => setSelected(run.id)}>
                <p className="font-medium">{run.id}</p>
                <p className="text-xs text-gray-400">{run.decision_type} · {run.base_sha.slice(0, 10)}</p>
              </button>
            ))}
            <div className="flex items-center justify-between text-sm">
              <button className="px-2 py-1 border border-border rounded disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span>{page}/{pages}</span>
              <button className="px-2 py-1 border border-border rounded disabled:opacity-50" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next</button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 md:col-span-2">
            {!runData ? <p className="text-gray-400">Select a run to inspect arbitration details.</p> : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm text-gray-400">Arbitration decision</p>
                  <p className="text-xl font-semibold">{String((runData.arbitration as Record<string, unknown> | undefined)?.decision_type ?? 'UNKNOWN')}</p>
                </div>
                <div className="rounded-lg border border-border p-3"><p className="font-medium mb-2">Candidate comparison</p><pre className="text-xs overflow-auto">{JSON.stringify(runData.per_patch ?? [], null, 2)}</pre></div>
                <div className="rounded-lg border border-border p-3"><p className="font-medium mb-2">Conflict matrix</p><pre className="text-xs overflow-auto">{JSON.stringify(runData.conflict_matrix ?? {}, null, 2)}</pre></div>
              </div>
            )}
          </section>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-4 space-y-2">
        <h2 className="font-semibold">Commands and references</h2>
        <CommandBlock command="npm run reach:cpx:run" />
        <CommandBlock command="npm run reach:cpx:report" />
        <Link href="/governance/economics" className="text-sm text-accent hover:underline">See cost and convergence telemetry</Link>
      </section>
    </div>
  );
}
