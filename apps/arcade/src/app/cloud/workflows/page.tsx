'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Workflow {
  id: string; name: string; description: string; status: string;
  version: number; updated_at: string; created_at: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = tenantId ? { 'X-Tenant-Id': tenantId } : {};

  useEffect(() => {
    fetch('/api/v1/workflows', { headers })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d: { workflows: Workflow[] }) => setWorkflows(d.workflows))
      .catch(() => setError('Failed to load workflows. Please sign in.'))
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      archived: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    return map[s] ?? map['draft'];
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-gray-400 mt-1">Build and manage your automation workflows</p>
        </div>
        <Link href="/builder" className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent/90">
          + New Workflow
        </Link>
      </div>

      {error && <div className="mb-4 p-3 rounded bg-red-500/10 text-red-400 text-sm border border-red-500/20">{error}</div>}

      {loading ? (
        <div className="text-gray-400">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-gray-400 mb-4">No workflows yet</p>
          <Link href="/builder" className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg">
            Create your first workflow
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-accent/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link href={`/cloud/workflows/${wf.id}`} className="font-medium text-white hover:text-accent">
                    {wf.name}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(wf.status)}`}>
                    {wf.status}
                  </span>
                  <span className="text-xs text-gray-500">v{wf.version}</span>
                </div>
                {wf.description && <p className="text-sm text-gray-500 mt-1 truncate">{wf.description}</p>}
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="text-xs text-gray-500">{new Date(wf.updated_at).toLocaleDateString()}</span>
                <Link href={`/builder?workflow=${wf.id}`} className="text-xs text-accent hover:underline">Edit</Link>
                <Link href={`/cloud/workflows/${wf.id}`} className="text-xs text-gray-400 hover:text-white">Details →</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
