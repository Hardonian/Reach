'use client';

import { useEffect, useState } from 'react';

interface Run {
  id: string; workflow_id: string; status: string; created_at: string;
  finished_at: string | null; error: string | null;
  inputs_json?: string; outputs_json?: string; metrics_json?: string;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = tenantId ? { 'X-Tenant-Id': tenantId } : {};

  useEffect(() => {
    fetch('/api/v1/workflow-runs?limit=100', { headers })
      .then((r) => r.ok ? r.json() : { runs: [] })
      .then((d: { runs: Run[] }) => setRuns(d.runs))
      .finally(() => setLoading(false));
  }, []);

  async function loadDetail(run: Run) {
    const res = await fetch(`/api/v1/workflow-runs/${run.id}`, { headers });
    if (res.ok) {
      const d = await res.json() as { run: Run };
      setSelected(d.run);
    } else {
      setSelected(run);
    }
  }

  const statusColor = (s: string) => ({
    completed: 'text-green-400', running: 'text-blue-400 animate-pulse',
    failed: 'text-red-400', queued: 'text-yellow-400',
  }[s] ?? 'text-gray-400');

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-bold text-white mb-2">Workflow Runs</h1>
      <p className="text-gray-400 mb-8">Execution history across all workflows</p>

      {loading ? (
        <div className="text-gray-400">Loading runs...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Run list */}
          <div className="space-y-2">
            {runs.length === 0 && <p className="text-gray-500 text-sm">No runs yet. Execute a workflow to see results here.</p>}
            {runs.map((run) => (
              <button key={run.id} onClick={() => loadDetail(run)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selected?.id === run.id ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:border-accent/40'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-300 truncate">{run.id.slice(0, 28)}</span>
                  <span className={`text-xs ml-2 ${statusColor(run.status)}`}>{run.status}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{new Date(run.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>

          {/* Run detail panel */}
          {selected && (
            <div className="rounded-xl border border-border bg-surface p-6 h-fit">
              <h2 className="font-semibold text-white mb-4">Run Details</h2>
              <dl className="space-y-3 text-sm">
                <div><dt className="text-gray-500">ID</dt><dd className="font-mono text-xs text-white mt-0.5 break-all">{selected.id}</dd></div>
                <div><dt className="text-gray-500">Status</dt><dd className={`mt-0.5 ${statusColor(selected.status)}`}>{selected.status}</dd></div>
                <div><dt className="text-gray-500">Started</dt><dd className="text-white mt-0.5">{new Date(selected.created_at).toLocaleString()}</dd></div>
                {selected.finished_at && <div><dt className="text-gray-500">Finished</dt><dd className="text-white mt-0.5">{new Date(selected.finished_at).toLocaleString()}</dd></div>}
                {selected.error && <div><dt className="text-gray-500">Error</dt><dd className="text-red-400 mt-0.5 text-xs">{selected.error}</dd></div>}
                {selected.outputs_json && (
                  <div>
                    <dt className="text-gray-500">Outputs</dt>
                    <pre className="mt-1 p-2 rounded bg-background text-xs text-green-300 overflow-auto max-h-40">
                      {JSON.stringify(JSON.parse(selected.outputs_json), null, 2)}
                    </pre>
                  </div>
                )}
                {selected.metrics_json && (
                  <div>
                    <dt className="text-gray-500">Metrics</dt>
                    <pre className="mt-1 p-2 rounded bg-background text-xs text-blue-300 overflow-auto max-h-32">
                      {JSON.stringify(JSON.parse(selected.metrics_json), null, 2)}
                    </pre>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
