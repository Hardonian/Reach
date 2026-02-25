"use client";

/**
 * Monitoring — real-time agent health dashboard.
 * Purpose: Always-on view of drift, latency, and failures in production.
 * Primary action: Create monitor.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface Signal {
  id: string;
  name: string;
  type: string;
  source: string;
  status: "enabled" | "disabled";
  created_at: string;
}
interface Health {
  total: number;
  alerts_today: number;
  latest_drift: number;
}

function MetricCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${alert ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-surface"}`}
    >
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${alert ? "text-orange-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function MonitoringPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [health] = useState<Health>({
    total: 0,
    alerts_today: 0,
    latest_drift: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "drift",
    source: "webhook",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/v1/signals").then((r) => r.json())])
      .then(([sigData]) => {
        setSignals(sigData.signals ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreateSignal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/v1/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = (await res.json()) as { signal: Signal };
      setSignals((prev) => [data.signal, ...prev]);
      setShowCreate(false);
    }
    setSaving(false);
  }

  async function toggleSignal(signal: Signal) {
    const next = signal.status === "enabled" ? "disabled" : "enabled";
    const res = await fetch(`/api/v1/signals/${signal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok)
      setSignals((prev) => prev.map((s) => (s.id === signal.id ? { ...s, status: next } : s)));
  }

  const driftLabel =
    health.latest_drift > 0.5 ? "⚠ High" : health.latest_drift > 0.2 ? "Moderate" : "Stable";

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Monitoring</h1>
            <p className="text-sm text-gray-400 mt-1">Always-on view of your agent's health.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.SETTINGS.ADVANCED.ALERTS}
              className="px-3 py-2 text-xs border border-border rounded-lg text-gray-400 hover:text-white"
            >
              Manage alerts
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create monitor
            </button>
          </div>
        </div>

        {/* Health today */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <MetricCard label="Total signals" value={signals.length} sub="active monitors" />
          <MetricCard
            label="Alerts today"
            value={health.alerts_today}
            sub="threshold breaches"
            alert={health.alerts_today > 0}
          />
          <MetricCard
            label="Drift score"
            value={typeof health.latest_drift === "number" ? health.latest_drift.toFixed(2) : "—"}
            sub={driftLabel}
            alert={health.latest_drift > 0.5}
          />
        </div>

        {/* Create monitor form */}
        {showCreate && (
          <div className="mb-6 p-5 rounded-xl border border-border bg-surface">
            <h2 className="text-base font-semibold text-white mb-4">New monitor</h2>
            <form onSubmit={handleCreateSignal} className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                  placeholder="Production latency"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  aria-label="Signal type"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                >
                  <option value="drift">Drift</option>
                  <option value="latency">Latency</option>
                  <option value="policy_violation">Policy violation</option>
                  <option value="tool_failure">Tool failure</option>
                  <option value="regression_rate">Regression rate</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  aria-label="Signal source"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                >
                  <option value="webhook">Webhook</option>
                  <option value="poller">Poller</option>
                </select>
              </div>
              <div className="col-span-3 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Create monitor"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Monitor list */}
        {loading ? (
          <div className="text-gray-400 text-sm py-12 text-center">Loading monitors…</div>
        ) : signals.length === 0 ? (
          <div className="text-center py-20 bg-surface/30 rounded-2xl border border-dashed border-border">
            <span className="material-symbols-outlined text-5xl text-gray-600 block mb-3">
              monitor_heart
            </span>
            <h3 className="text-base font-medium text-white mb-1">Start monitoring</h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
              Get alerted when your agent drifts, spikes in latency, or violates policy.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
            >
              Create your first monitor
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {signals.map((signal) => (
              <div key={signal.id} className="p-4 rounded-xl border border-border bg-surface">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-accent">
                      sensors
                    </span>
                    <span className="text-sm font-medium text-white">{signal.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs bg-surface border border-border text-gray-400">
                      {signal.type}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        signal.status === "enabled"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {signal.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">via {signal.source}</span>
                    <button
                      onClick={() => toggleSignal(signal)}
                      className="px-3 py-1 text-xs border border-border rounded-lg text-gray-400 hover:text-white"
                    >
                      {signal.status === "enabled" ? "Pause" : "Enable"}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Ingest via:{" "}
                  <code className="font-mono text-gray-400">POST /api/monitor/ingest</code> with
                  signal_id: <code className="font-mono text-gray-400">{signal.id}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
