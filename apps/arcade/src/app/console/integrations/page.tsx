"use client";

import { useState, useEffect } from "react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "connected" | "disconnected" | "error";
  lastTestedAt?: string;
  errorMessage?: string;
  config: {
    webhookUrl?: string;
    apiKey?: string;
    [key: string]: string | undefined;
  };
}

const INTEGRATION_TEMPLATES: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Connect to GitHub for repository webhooks and PR checks",
    icon: "🐙",
    status: "disconnected",
    config: {},
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send alerts and notifications to Slack channels",
    icon: "💬",
    status: "disconnected",
    config: {},
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Escalate critical alerts to PagerDuty",
    icon: "🚨",
    status: "disconnected",
    config: {},
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send events to your own HTTP endpoints",
    icon: "🔗",
    status: "disconnected",
    config: {},
  },
];

function StatusBadge({ status, error }: { status: string; error?: string }) {
  const styles: Record<string, string> = {
    connected: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    disconnected: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
    testing: "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[status] || styles.disconnected}`}>
      {status === "testing" ? "Testing..." : status}
    </span>
  );
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  async function fetchIntegrations() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/integrations");
      if (res.ok) {
        const data = await res.json();
        // Merge with templates to ensure all options shown
        const connected = data.integrations || [];
        const merged = INTEGRATION_TEMPLATES.map(t => 
          connected.find((c: Integration) => c.id === t.id) || t
        );
        setIntegrations(merged);
      } else {
        setIntegrations(INTEGRATION_TEMPLATES);
      }
    } catch {
      setIntegrations(INTEGRATION_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(integration: Integration) {
    setTestStatus(prev => ({ ...prev, [integration.id]: "testing" }));
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}/test`, {
        method: "POST",
      });
      if (res.ok) {
        setTestStatus(prev => ({ ...prev, [integration.id]: "success" }));
        setTimeout(() => {
          setTestStatus(prev => ({ ...prev, [integration.id]: "idle" }));
        }, 2000);
      } else {
        setTestStatus(prev => ({ ...prev, [integration.id]: "error" }));
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [integration.id]: "error" }));
    }
  }

  async function saveIntegration(integration: Integration) {
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(integration),
      });
      if (res.ok) {
        await fetchIntegrations();
        setSelectedIntegration(null);
      }
    } catch (err) {
      console.error("Failed to save integration:", err);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-8 bg-surface rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="animate-pulse h-32 bg-surface rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-gray-400 text-sm">Connect ReadyLayer to your tools and services</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <div key={integration.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{integration.icon}</span>
                <div>
                  <h3 className="font-semibold">{integration.name}</h3>
                  <StatusBadge 
                    status={testStatus[integration.id] === "testing" ? "testing" : integration.status} 
                    error={integration.errorMessage}
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-4">{integration.description}</p>
            
            <div className="flex gap-2">
              {integration.status === "connected" ? (
                <>
                  <button 
                    onClick={() => testConnection(integration)}
                    disabled={testStatus[integration.id] === "testing"}
                    className="btn-secondary text-sm flex-1"
                  >
                    {testStatus[integration.id] === "testing" ? "Testing..." : "Test Connection"}
                  </button>
                  <button 
                    onClick={() => setSelectedIntegration(integration)}
                    className="btn-secondary text-sm"
                  >
                    Configure
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setSelectedIntegration(integration)}
                  className="btn-primary text-sm flex-1"
                >
                  Set Up
                </button>
              )}
            </div>

            {testStatus[integration.id] === "success" && (
              <p className="text-xs text-emerald-400 mt-2">✓ Connection successful</p>
            )}
            {testStatus[integration.id] === "error" && (
              <p className="text-xs text-red-400 mt-2">✗ Connection failed</p>
            )}
          </div>
        ))}
      </div>

      {/* Setup Modal */}
      {selectedIntegration && (
        <IntegrationSetupModal
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
          onSave={saveIntegration}
        />
      )}
    </div>
  );
}

function IntegrationSetupModal({
  integration,
  onClose,
  onSave,
}: {
  integration: Integration;
  onClose: () => void;
  onSave: (i: Integration) => void;
}) {
  const [config, setConfig] = useState(integration.config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "success" | "error">("idle");

  async function testBeforeSave() {
    setTesting(true);
    setTestResult("idle");
    try {
      const res = await fetch(`/api/v1/integrations/${integration.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setTestResult(res.ok ? "success" : "error");
      return res.ok;
    } catch {
      setTestResult("error");
      return false;
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    const passed = await testBeforeSave();
    if (passed) {
      onSave({ ...integration, config, status: "connected" });
    }
  }

  const fields: Record<string, { label: string; type: string; placeholder: string }[]> = {
    github: [
      { label: "Repository Owner", type: "text", placeholder: "e.g., myorg" },
      { label: "Repository Name", type: "text", placeholder: "e.g., myrepo" },
    ],
    slack: [
      { label: "Webhook URL", type: "url", placeholder: "https://hooks.slack.com/..." },
      { label: "Channel", type: "text", placeholder: "#alerts" },
    ],
    pagerduty: [
      { label: "Routing Key", type: "password", placeholder: "Your PagerDuty integration key" },
    ],
    webhook: [
      { label: "Endpoint URL", type: "url", placeholder: "https://your-api.com/webhook" },
      { label: "Secret (optional)", type: "password", placeholder: "Webhook signing secret" },
    ],
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{integration.icon}</span>
          <div>
            <h2 className="text-lg font-semibold">Set Up {integration.name}</h2>
            <p className="text-sm text-gray-400">Configure your connection</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {fields[integration.id]?.map((field, i) => (
            <div key={i}>
              <label className="block text-sm font-medium mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={config[field.label.toLowerCase().replace(/\s+/g, "_")] || ""}
                onChange={(e) => setConfig({ 
                  ...config, 
                  [field.label.toLowerCase().replace(/\s+/g, "_")]: e.target.value 
                })}
                className="w-full px-4 py-2 rounded bg-surface border border-border focus:outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>

        {testResult === "success" && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-3 mb-4">
            <p className="text-sm text-emerald-400">✓ Connection test passed</p>
          </div>
        )}
        {testResult === "error" && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4">
            <p className="text-sm text-red-400">✗ Connection test failed. Check your settings.</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={testing}
            className="btn-primary"
          >
            {testing ? "Testing..." : "Save & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
