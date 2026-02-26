"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "active" | "draft" | "archived";
  version: string;
  lastRunAt: string | null;
  runCount: number;
}

function LoadingState() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-surface rounded w-1/4"></div>
        <div className="h-4 bg-surface rounded w-1/2"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-surface rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="p-8">
      <div className="card border-red-500/30 bg-red-500/5">
        <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Workflows</h2>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={retry} className="btn-secondary text-sm">
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-4">⚡</div>
      <h3 className="text-lg font-semibold mb-2">No Workflows Yet</h3>
      <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
        Workflows define your agent execution steps, policies, and gates. Create your first workflow to start orchestrating agents.
      </p>
      <button className="btn-primary">Create Workflow</button>
    </div>
  );
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      setLoading(true);
      setError(null);
      // Connect to real API when available
      const res = await fetch("/api/v1/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data.workflows || []);
      } else {
        // Graceful fallback - show empty state rather than error
        setWorkflows([]);
      }
    } catch (err) {
      // Graceful fallback - show empty state
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} retry={fetchWorkflows} />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-gray-400 text-sm">Manage your agent execution workflows</p>
        </div>
        <Link href="/studio" className="btn-primary flex items-center gap-2">
          <span>+</span>
          New Workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <Link
              key={workflow.id}
              href={`/cloud/workflows/${workflow.id}`}
              className="card block hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{workflow.name}</h3>
                  <p className="text-gray-400 text-sm">{workflow.description}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      workflow.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : workflow.status === "draft"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {workflow.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
