"use client";

import { useState, useEffect, useCallback } from "react";
import { BRAND_NAME } from "@/lib/brand";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

interface ApiKeyResponse {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
}

interface CreateKeyResponse {
  api_key: ApiKeyResponse;
  raw_key: string;
}

const AVAILABLE_SCOPES = [
  { value: "read", label: "Read Only", description: "View resources and data" },
  { value: "write", label: "Write", description: "Create and modify resources" },
  { value: "admin", label: "Admin", description: "Full administrative access" },
  { value: "runner", label: "Runner", description: "Execute workflows and agents" },
];

function LoadingState() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-surface rounded w-1/4"></div>
      <div className="h-64 bg-surface rounded"></div>
    </div>
  );
}

function ErrorState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="card border-red-500/30 bg-red-500/5">
      <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load API Keys</h2>
      <p className="text-gray-400 text-sm mb-4">{error}</p>
      <button onClick={retry} className="btn-secondary text-sm">
        Retry
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-4">🔑</div>
      <h3 className="text-lg font-semibold mb-2">No API Keys Yet</h3>
      <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
        API keys allow you to authenticate with the {BRAND_NAME} API from your applications and scripts.
      </p>
      <button onClick={onCreate} className="btn-primary">
        Create Your First API Key
      </button>
    </div>
  );
}

function KeyRevealModal({
  keyName,
  rawKey,
  onClose,
}: {
  keyName: string;
  rawKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-lg w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <span className="material-symbols-outlined">key</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">API Key Created</h3>
            <p className="text-gray-400 text-sm">Copy this key now - you won&apos;t see it again</p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{keyName}</span>
            <button
              onClick={copyToClipboard}
              className="text-sm text-accent hover:text-accent/80 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <code className="block bg-black/30 rounded px-3 py-2 text-sm font-mono break-all">
            {rawKey}
          </code>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-200 flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            <span>
              This is the only time you&apos;ll see this key. Store it securely in a secrets manager
              or environment variable.
            </span>
          </p>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="btn-primary">
            I&apos;ve Saved the Key
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateKeyModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, scopes: string[]) => Promise<string | undefined>;
}) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    const rawKey = await onCreate(name.trim(), selectedScopes);
    setCreating(false);
    if (rawKey) {
      setName("");
      setSelectedScopes(["read"]);
      onClose();
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="card max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Create New API Key</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Key Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Production Runner"
            className="w-full px-4 py-2 rounded bg-surface border border-border focus:outline-none focus:border-accent"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Scopes</label>
          <div className="space-y-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className="flex items-start gap-3 p-3 rounded border border-border hover:border-accent/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{scope.label}</div>
                  <div className="text-sm text-gray-400">{scope.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim() || selectedScopes.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Key"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RevokeConfirmModal({
  keyName,
  onConfirm,
  onCancel,
}: {
  keyName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <span className="material-symbols-outlined">delete</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Revoke API Key</h3>
            <p className="text-gray-400 text-sm">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm mb-6">
          Are you sure you want to revoke the API key <strong>{keyName}</strong>? Any applications
          using this key will immediately lose access.
        </p>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
            Revoke Key
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyReveal, setNewKeyReveal] = useState<{ name: string; rawKey: string } | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<ApiKey | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/api-keys");
      if (!res.ok) {
        throw new Error(`Failed to load API keys: ${res.statusText}`);
      }

      const data = await res.json();
      setKeys(data.api_keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async (name: string, scopes: string[]): Promise<string | undefined> => {
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scopes }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to create API key");
      }

      const data: CreateKeyResponse = await res.json();
      await fetchKeys(); // Refresh the list
      setNewKeyReveal({ name: data.api_key.name, rawKey: data.raw_key });
      return data.raw_key;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
      return undefined;
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      const res = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to revoke API key");
      }

      await fetchKeys();
      setRevokeConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Settings</span>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-white">API Keys</span>
      </div>

      {error && <ErrorState error={error} retry={fetchKeys} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-gray-400 text-sm">
            Manage API keys for accessing the {BRAND_NAME} platform
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create New Key
        </button>
      </div>

      {/* Keys List */}
      {keys.length === 0 ? (
        <EmptyState onCreate={() => setShowCreateModal(true)} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Scopes</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Last Used</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-surface/50">
                  <td className="py-4 px-4 font-medium">{key.name}</td>
                  <td className="py-4 px-4">
                    <code className="text-xs px-2 py-1 rounded bg-surface">{key.key_prefix}</code>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex gap-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="text-xs px-2 py-1 rounded bg-accent/10 text-accent"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-400">{formatDate(key.created_at)}</td>
                  <td className="py-4 px-4 text-sm text-gray-400">{formatDate(key.last_used_at)}</td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={() => setRevokeConfirm(key)}
                      className="p-2 rounded text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Revoke Key"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateKey}
      />

      {newKeyReveal && (
        <KeyRevealModal
          keyName={newKeyReveal.name}
          rawKey={newKeyReveal.rawKey}
          onClose={() => setNewKeyReveal(null)}
        />
      )}

      {revokeConfirm && (
        <RevokeConfirmModal
          keyName={revokeConfirm.name}
          onConfirm={() => handleRevokeKey(revokeConfirm.id)}
          onCancel={() => setRevokeConfirm(null)}
        />
      )}
    </div>
  );
}
