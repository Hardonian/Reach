"use client";

/**
 * Release Gates — connect repos to protect deployments/merges.
 * Purpose: Block merges when agent readiness checks fail.
 * Primary action: Create a gate.
 */

import { useState, useEffect } from "react";

interface Gate {
  id: string;
  name: string;
  repo_owner: string;
  repo_name: string;
  default_branch: string;
  status: "enabled" | "disabled";
  trigger_types: string[];
  required_checks: unknown[];
  created_at: string;
}

function StatusBadge({ status }: { status: "enabled" | "disabled" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        status === "enabled" ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${status === "enabled" ? "bg-green-400" : "bg-gray-400"}`}
      />
      {status}
    </span>
  );
}

export default function ReleaseGatesPage() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    repo_owner: "",
    repo_name: "",
    default_branch: "main",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/gates")
      .then((r) => r.json())
      .then((d) => {
        setGates(d.gates ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/gates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, trigger_types: ["pr", "push"] }),
      });
      const data = (await res.json()) as { gate?: Gate; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create gate");
        return;
      }
      setGates((prev) => [data.gate!, ...prev]);
      setShowCreate(false);
      setForm({
        name: "",
        repo_owner: "",
        repo_name: "",
        default_branch: "main",
      });
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleGate(gate: Gate) {
    const next = gate.status === "enabled" ? "disabled" : "enabled";
    const res = await fetch(`/api/v1/gates/${gate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setGates((prev) => prev.map((g) => (g.id === gate.id ? { ...g, status: next } : g)));
    }
  }

  async function runGate(gateId: string) {
    await fetch(`/api/v1/gates/${gateId}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_type: "manual" }),
    });
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Release Gates</h1>
          <p className="text-sm text-gray-400 mt-1">
            Block deployments when agent readiness checks fail.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create gate
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 p-5 rounded-xl border border-border bg-surface">
          <h2 className="text-base font-semibold text-white mb-4">New release gate</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1">Gate name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="Production gate"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Repo owner</label>
              <input
                value={form.repo_owner}
                onChange={(e) => setForm((f) => ({ ...f, repo_owner: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="acme-corp"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Repo name</label>
              <input
                value={form.repo_name}
                onChange={(e) => setForm((f) => ({ ...f, repo_name: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="my-agent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Default branch</label>
              <input
                value={form.default_branch}
                onChange={(e) => setForm((f) => ({ ...f, default_branch: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-white"
                placeholder="main"
              />
            </div>
            {error && <p className="col-span-2 text-xs text-red-400">{error}</p>}
            <div className="col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create gate"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-400 text-sm hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Gate list */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8">
          <span>Loading gates…</span>
        </div>
      ) : gates.length === 0 ? (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-gray-600 block mb-3">
            verified
          </span>
          <h3 className="text-base font-medium text-white mb-1">No gates yet</h3>
          <p className="text-sm text-gray-400 mb-4">Connect a repo to protect releases.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium"
          >
            Connect GitHub repo
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {gates.map((gate) => (
            <div
              key={gate.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:bg-surface/80"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px] text-accent">verified</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{gate.name}</span>
                    <StatusBadge status={gate.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {gate.repo_owner}/{gate.repo_name} · {gate.default_branch}
                    {" · "}
                    {gate.required_checks.length} check(s)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runGate(gate.id)}
                  className="px-3 py-1.5 text-xs text-gray-300 border border-border rounded-lg hover:border-accent hover:text-accent"
                >
                  Run now
                </button>
                <button
                  onClick={() => toggleGate(gate)}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${
                    gate.status === "enabled"
                      ? "border-border text-gray-400 hover:text-white"
                      : "border-green-500/30 text-green-400 hover:border-green-500"
                  }`}
                >
                  {gate.status === "enabled" ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhook info */}
      {gates.length > 0 && (
        <div className="mt-6 p-4 rounded-xl border border-border bg-surface/50">
          <h3 className="text-sm font-medium text-white mb-1">GitHub webhook URL</h3>
          <code className="text-xs text-gray-400 font-mono bg-background px-2 py-1 rounded">
            {typeof window !== "undefined" ? window.location.origin : ""}
            /api/github/webhook
          </code>
          <p className="text-xs text-gray-500 mt-2">
            Set this as your repo webhook URL. Use secret from GITHUB_WEBHOOK_SECRET.
          </p>
        </div>
      )}
    </div>
  );
}
