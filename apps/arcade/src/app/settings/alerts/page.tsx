'use client';

/**
 * Alerts — configure where to send notifications when monitors fire.
 * Purpose: Get notified when your agent drifts or fails.
 * Primary action: Create alert rule.
 */

import { useState, useEffect } from 'react';

interface AlertRule {
  id: string; name: string; channel: 'email' | 'webhook';
  destination: string; status: 'enabled' | 'disabled'; created_at: string;
}

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'email' as 'email' | 'webhook', destination: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/alerts').then((r) => r.json()).then((d) => {
      setRules(d.alert_rules ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { alert_rule?: AlertRule; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to create rule'); return; }
      setRules((prev) => [data.alert_rule!, ...prev]);
      setShowCreate(false);
      setForm({ name: '', channel: 'email', destination: '' });
    } catch { setError('Network error'); } finally { setSaving(false); }
  }

  async function toggleRule(rule: AlertRule) {
    const next = rule.status === 'enabled' ? 'disabled' : 'enabled';
    const res = await fetch(`/api/v1/alerts/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, status: next } : r));
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this alert rule?')) return;
    await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE' });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alerts</h1>
          <p className="text-sm text-gray-400 mt-1">Get notified when your agent drifts or a monitor fires.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add alert
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-5 rounded-xl border border-border bg-surface">
          <h2 className="text-base font-semibold text-white mb-4">New alert rule</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Rule name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="Drift alert" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Channel</label>
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as 'email' | 'webhook' }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white">
                <option value="email">Email</option>
                <option value="webhook">Webhook (Slack/Discord)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                {form.channel === 'email' ? 'Email address' : 'Webhook URL'}
              </label>
              <input value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder={form.channel === 'email' ? 'you@company.com' : 'https://hooks.slack.com/...'} required />
            </div>
            {error && <p className="col-span-2 text-xs text-red-400">{error}</p>}
            <div className="col-span-2 flex items-center gap-3">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save rule'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8">Loading…</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">notifications_active</span>
          <h3 className="text-base font-medium text-white mb-1">No alert rules</h3>
          <p className="text-sm text-gray-400 mb-4">Get alerted when your agent drifts.</p>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium">
            Create alert
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-gray-400">
                    {rule.channel === 'email' ? 'email' : 'webhook'}
                  </span>
                  <span className="text-sm font-medium text-white">{rule.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    rule.status === 'enabled' ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'
                  }`}>{rule.status}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{rule.destination}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleRule(rule)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg text-gray-400 hover:text-white">
                  {rule.status === 'enabled' ? 'Pause' : 'Enable'}
                </button>
                <button onClick={() => deleteRule(rule.id)}
                  className="px-3 py-1.5 text-xs border border-red-500/20 rounded-lg text-red-400 hover:border-red-500">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
