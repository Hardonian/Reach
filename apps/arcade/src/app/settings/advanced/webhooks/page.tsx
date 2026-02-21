'use client';

import { BRAND_NAME } from '@/lib/brand';

export default function WebhooksPage() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span>Advanced</span>
        <span className="material-symbols-outlined text-[12px]">chevron_right</span>
        <span className="text-white">Webhooks</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Webhooks</h1>
      <p className="text-gray-400 max-w-2xl mb-8">
        Configure HTTP callbacks to receive real-time notifications when events occur in your {BRAND_NAME} workspace.
      </p>

      {/* Create Webhook */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
          <button className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Add Endpoint
          </button>
        </div>

        <div className="space-y-3">
          {[
            { url: 'https://hooks.acme.corp/reach/runs', events: 'run.completed, run.failed', status: 'Active', lastDelivery: '2 mins ago' },
            { url: 'https://slack.acme.corp/webhooks/alerts', events: 'alert.triggered', status: 'Active', lastDelivery: '1 hour ago' },
          ].map((wh) => (
            <div key={wh.url} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.03] border border-border">
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono text-gray-300 truncate block">{wh.url}</code>
                <p className="text-xs text-gray-500 mt-1">
                  Events: <span className="text-gray-400">{wh.events}</span> · Last delivery: {wh.lastDelivery}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <span className="status-pill online text-xs">{wh.status}</span>
                <button className="p-1 rounded text-gray-400 hover:text-accent hover:bg-white/5 transition-colors" title="Edit">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Delete">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Recent Deliveries</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-gray-500 uppercase text-xs font-semibold tracking-wider">
            <tr>
              <th className="px-6 py-3">Event</th>
              <th className="px-6 py-3">Endpoint</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { event: 'run.completed', endpoint: 'hooks.acme.corp', code: '200', time: '2 mins ago' },
              { event: 'alert.triggered', endpoint: 'slack.acme.corp', code: '200', time: '1 hour ago' },
              { event: 'run.failed', endpoint: 'hooks.acme.corp', code: '200', time: '3 hours ago' },
            ].map((d, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-3"><code className="text-xs font-mono">{d.event}</code></td>
                <td className="px-6 py-3 text-gray-400">{d.endpoint}</td>
                <td className="px-6 py-3"><span className="status-pill online text-xs">{d.code}</span></td>
                <td className="px-6 py-3 text-gray-400">{d.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
