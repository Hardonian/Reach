'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CloudOverviewData {
  user?: { display_name: string; email: string };
  tenant?: { name: string; plan: string };
  workflows?: { id: string; name: string; status: string; updated_at: string }[];
  runs?: { id: string; status: string; created_at: string }[];
  billing?: { plan: string; usage: { runs_used: number; runs_limit: number } };
}

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-surface">
      <p className="text-xs text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function CloudOverviewPage() {
  const [data, setData] = useState<CloudOverviewData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
    const headers: HeadersInit = tenantId ? { 'X-Tenant-Id': tenantId } : {};

    Promise.all([
      fetch('/api/v1/auth/me', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/v1/workflows', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/v1/workflow-runs?limit=20', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/v1/billing', { headers }).then((r) => r.ok ? r.json() : null),
    ]).then(([me, workflows, runs, billing]) => {
      setData({
        user: me?.user,
        tenant: me?.tenant,
        workflows: workflows?.workflows?.slice(0, 5),
        runs: runs?.runs?.slice(0, 5),
        billing,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-400">Loading...</div>;
  }

  if (!data.user) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl text-white mb-4">Not signed in</h2>
        <Link href="/cloud/login" className="text-accent hover:underline">Sign in to Reach Cloud</Link>
      </div>
    );
  }

  const statusColor = (s: string) => ({
    completed: 'text-green-400', running: 'text-blue-400', failed: 'text-red-400',
    queued: 'text-yellow-400', active: 'text-green-400', draft: 'text-gray-400',
  }[s] ?? 'text-gray-400');

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {data.user.display_name}
        </h1>
        <p className="text-gray-400 mt-1">
          {data.tenant?.name} · <span className="capitalize">{data.tenant?.plan ?? 'free'}</span> plan
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Workflows" value={data.workflows?.length ?? 0} sub="total" />
        <StatCard title="Runs This Month" value={data.billing?.usage?.runs_used ?? 0}
          sub={data.billing?.usage?.runs_limit === -1 ? 'unlimited' : `of ${data.billing?.usage?.runs_limit ?? 100}`} />
        <StatCard title="Recent Runs" value={data.runs?.length ?? 0} sub="last 20" />
        <StatCard title="Plan" value={data.billing?.plan ?? 'free'} sub="current" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workflows */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Workflows</h2>
            <Link href="#" className="text-xs text-accent hover:underline" title="Coming Soon">View all →</Link>
          </div>
          {data.workflows?.length ? (
            <ul className="space-y-2">
              {data.workflows.map((wf) => (
                <li key={wf.id}>
                  <Link href="#" className="flex items-center justify-between py-2 hover:text-accent" title="Coming Soon">
                    <span className="text-sm text-white">{wf.name}</span>
                    <span className={`text-xs ${statusColor(wf.status)}`}>{wf.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No workflows yet.{' '}
              <Link href="#" className="text-accent hover:underline" title="Coming Soon">Create one →</Link>
            </p>
          )}
        </div>

        {/* Recent Runs */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Runs</h2>
            <Link href="#" className="text-xs text-accent hover:underline" title="Coming Soon">View all →</Link>
          </div>
          {data.runs?.length ? (
            <ul className="space-y-2">
              {data.runs.map((run) => (
                <li key={run.id} className="flex items-center justify-between py-2">
                  <span className="text-xs font-mono text-gray-400">{run.id.slice(0, 20)}…</span>
                  <span className={`text-xs ${statusColor(run.status)}`}>{run.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No runs yet. Execute a workflow to see results.</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-8 flex gap-3 flex-wrap">
        <Link href="#" className="px-4 py-2 bg-accent text-black text-sm font-semibold rounded-lg hover:bg-accent/90" title="Coming Soon">
          + New Workflow
        </Link>
        <Link href="/marketplace" className="px-4 py-2 border border-border text-white text-sm rounded-lg hover:border-accent">
          Browse Marketplace
        </Link>
        <Link href="#" className="px-4 py-2 border border-border text-white text-sm rounded-lg hover:border-accent" title="Coming Soon">
          Manage Billing
        </Link>
      </div>
    </div>
  );
}
