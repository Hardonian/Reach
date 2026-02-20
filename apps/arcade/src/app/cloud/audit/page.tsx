'use client';

import { useEffect, useState } from 'react';

interface AuditEvent {
  id: number; tenant_id: string; user_id: string | null;
  action: string; resource: string; resource_id: string;
  metadata_json: string; ip_address: string | null; created_at: string;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('reach_tenant_id') ?? '' : '';
  const headers: HeadersInit = tenantId ? { 'X-Tenant-Id': tenantId } : {};

  useEffect(() => {
    fetch('/api/v1/audit?limit=100', { headers })
      .then((r) => r.ok ? r.json() : { events: [] })
      .then((d: { events: AuditEvent[] }) => setEvents(d.events))
      .finally(() => setLoading(false));
  }, []);

  const actionColor = (action: string) => {
    if (action.includes('create')) return 'text-green-400';
    if (action.includes('delete') || action.includes('revoke')) return 'text-red-400';
    if (action.includes('update') || action.includes('report')) return 'text-yellow-400';
    return 'text-blue-400';
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-2">Audit Log</h1>
      <p className="text-gray-400 mb-8">Immutable record of all actions in your tenant</p>

      {loading ? (
        <div className="text-gray-400">Loading audit events...</div>
      ) : events.length === 0 ? (
        <p className="text-gray-500">No audit events yet. Actions will appear here automatically.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Time</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Action</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Resource</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">Resource ID</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">User</th>
                <th className="text-left px-4 py-3 text-xs text-gray-500">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-surface/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-xs font-mono ${actionColor(ev.action)}`}>{ev.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-300">{ev.resource}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-400 max-w-32 truncate">{ev.resource_id}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-32 truncate">{ev.user_id?.slice(0, 16) ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{ev.ip_address ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
