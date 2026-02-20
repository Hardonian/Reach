'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';

interface WorkflowDetail {
  id: string; name: string; description: string; status: string;
  version: number; graph: unknown; updated_at: string; created_at: string;
}
interface Run {
  id: string; status: string; created_at: string; finished_at: string | null;
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [wf, setWf] = useState<WorkflowDetail | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}) };

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/workflows/${id}`, { headers }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/v1/workflows/${id}/runs`, { headers }).then((r) => r.ok ? r.json() : null),
    ]).then(([wfData, runsData]) => {
      setWf(wfData?.workflow ?? null);
      setRuns(runsData?.runs ?? []);
    }).finally(() => setLoading(false));
  }, [id]);

  async function triggerRun() {
    setRunning(true);
    try {
      const res = await fetch(`/api/v1/workflows/${id}/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: {} }),
      });
      if (res.ok) {
        const data = await res.json() as { run: Run };
        setRuns((prev) => [data.run, ...prev]);
      }
    } finally {
      setRunning(false);
    }
  }

  const statusColor = (s: string) => ({
    completed: 'text-green-400', running: 'text-blue-400', failed: 'text-red-400',
    queued: 'text-yellow-400',
  }[s] ?? 'text-gray-400');

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;
  if (!wf) return <div className="p-8 text-red-400">Workflow not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/cloud/workflows" className="hover:text-accent">Workflows</Link>
        <span>/</span>
        <span className="text-white">{wf.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{wf.name}</h1>
          {wf.description && <p className="text-gray-400 mt-1">{wf.description}</p>}
          <p className="text-xs text-gray-500 mt-2">Version {wf.version} · {wf.status}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/builder?workflow=${id}`} className="px-4 py-2 border border-border text-white text-sm rounded-lg hover:border-accent">
            Edit in Builder
          </Link>
          <button onClick={triggerRun} disabled={running}
            className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent/90 disabled:opacity-50">
            {running ? 'Starting...' : '▶ Run'}
          </button>
        </div>
      </div>

      {/* Graph overview */}
      <div className="mb-8 p-4 rounded-xl border border-border bg-surface">
        <h2 className="text-sm font-semibold text-white mb-3">Graph</h2>
        {(() => {
          const g = wf.graph as { nodes?: { id: string; type: string; name: string }[]; edges?: { from: string; to: string }[] };
          return (
            <div className="flex flex-wrap gap-2">
              {(g.nodes ?? []).map((n, i) => (
                <div key={n.id} className="flex items-center gap-1">
                  <span className="px-3 py-1 rounded-lg bg-accent/10 border border-accent/20 text-xs text-white">
                    {n.name}
                  </span>
                  {i < (g.nodes ?? []).length - 1 && <span className="text-gray-600 text-xs">→</span>}
                </div>
              ))}
              {(g.nodes ?? []).length === 0 && <p className="text-gray-500 text-sm">Empty graph</p>}
            </div>
          );
        })()}
      </div>

      {/* Runs */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Runs ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="text-gray-500 text-sm">No runs yet. Click Run to execute this workflow.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface/50">
                <span className="text-xs font-mono text-gray-400">{run.id}</span>
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${statusColor(run.status)}`}>{run.status}</span>
                  <span className="text-xs text-gray-500">{new Date(run.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
