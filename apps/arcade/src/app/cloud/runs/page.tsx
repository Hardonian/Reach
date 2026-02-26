"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
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
        <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Runs</h2>
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
      <div className="text-4xl mb-4">▶</div>
      <h3 className="text-lg font-semibold mb-2">No Runs Yet</h3>
      <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
        Workflow runs will appear here when you execute workflows. Start a workflow to see your execution history.
      </p>
      <Link href="/cloud/workflows" className="btn-primary">
        Go to Workflows
      </Link>
    </div>
  );
}

function StatusBadge({ status }: { status: Run["status"] }) {
  const styles = {
    running: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
    cancelled: "bg-gray-500/10 text-gray-400",
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${styles[status]}`}>
      {status === "running" && <span className="animate-pulse mr-1">●</span>}
      {status}
    </span>
  );
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  async function fetchRuns() {
    try {
      setLoading(true);
      setError(null);
      // Connect to real API when available
      const res = await fetch("/api/v1/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      } else {
        // Graceful fallback
        setRuns([]);
      }
    } catch (err) {
      // Graceful fallback
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} retry={fetchRuns} />;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Workflow Runs</h1>
          <p className="text-gray-400 text-sm">View and manage your workflow executions</p>
        </div>
      </div>

      {runs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/cloud/runs/${run.id}`}
              className="card block hover:border-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{run.workflowName}</h3>
                  <p className="text-gray-400 text-sm">
                    Triggered by {run.triggeredBy} • {new Date(run.startedAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={run.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
