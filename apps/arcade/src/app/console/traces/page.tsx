"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface Trace {
  id: string;
  run_id: string;
  workflow_id?: string;
  workflow_name?: string;
  gate_id?: string;
  gate_name?: string;
  trace_type: "workflow" | "gate" | "tool" | "agent";
  status: "running" | "completed" | "failed" | "cancelled";
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  steps: TraceStep[];
  metadata: {
    agent_name?: string;
    tool_name?: string;
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
  };
}

interface TraceStep {
  id: string;
  step_number: number;
  name: string;
  type: "llm" | "tool" | "decision" | "gate" | "error";
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-blue-500/10 text-blue-400",
    completed: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
    cancelled: "bg-gray-500/10 text-gray-400",
    pending: "bg-amber-500/10 text-amber-400",
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status === "running" && <span className="animate-pulse mr-1">●</span>}
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    workflow: "⚡",
    gate: "🚧",
    tool: "🔧",
    agent: "🤖",
  };
  return (
    <span className="text-lg" title={`Type: ${type}`}>
      {icons[type] || "📋"}
    </span>
  );
}

function TraceList() {
  const searchParams = useSearchParams();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "");
  const limit = 20;

  const fetchTraces = useCallback(async (currentOffset = offset) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(currentOffset));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/v1/traces?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load traces");

      const data = await res.json();
      setTraces(data.traces);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load traces");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, offset, limit]);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);

  const handleSearch = () => {
    setOffset(0);
    fetchTraces(0);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setOffset(0);
    fetchTraces(0);
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Trace Explorer</h1>
        <p className="text-gray-400 text-sm">
          Query and analyze execution traces across workflows and gates
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by run ID, workflow, or gate name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full px-4 py-2 rounded bg-surface border border-border focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded bg-surface border border-border focus:outline-none focus:border-accent"
          >
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 rounded bg-surface border border-border focus:outline-none focus:border-accent"
          >
            <option value="">All Types</option>
            <option value="workflow">Workflow</option>
            <option value="gate">Gate</option>
            <option value="tool">Tool</option>
            <option value="agent">Agent</option>
          </select>
          <button onClick={handleSearch} className="btn-primary">
            Search
          </button>
          {(search || statusFilter || typeFilter) && (
            <button onClick={clearFilters} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card border-red-500/30 bg-red-500/5">
          <p className="text-red-400">{error}</p>
          <button onClick={() => fetchTraces()} className="text-sm text-accent mt-2">
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-surface rounded"></div>
          ))}
        </div>
      )}

      {/* Trace List */}
      {!loading && !error && (
        <>
          <div className="space-y-2">
            {traces.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">No Traces Found</h3>
                <p className="text-gray-400 text-sm">
                  {search || statusFilter || typeFilter
                    ? "Try adjusting your filters"
                    : "Traces will appear here when workflows and gates are executed"}
                </p>
              </div>
            ) : (
              traces.map((trace) => (
                <Link
                  key={trace.id}
                  href={`/console/traces/${trace.id}`}
                  className="card block hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <TypeBadge type={trace.trace_type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={trace.status} />
                        <span className="text-xs text-gray-500">
                          {trace.workflow_name || trace.gate_name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <code className="text-xs bg-surface px-2 py-0.5 rounded truncate max-w-[200px]">
                          {trace.run_id}
                        </code>
                        <span>•</span>
                        <span>{new Date(trace.started_at).toLocaleString()}</span>
                        {trace.duration_ms && (
                          <>
                            <span>•</span>
                            <span>{(trace.duration_ms / 1000).toFixed(2)}s</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        {trace.steps.length} steps
                      </div>
                      {trace.metadata.cost_usd && (
                        <div className="text-xs text-gray-500">
                          ${trace.metadata.cost_usd.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} traces
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newOffset = Math.max(0, offset - limit);
                    setOffset(newOffset);
                    fetchTraces(newOffset);
                  }}
                  disabled={offset === 0}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => {
                    const newOffset = offset + limit;
                    setOffset(newOffset);
                    fetchTraces(newOffset);
                  }}
                  disabled={offset + limit >= total}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse h-8 bg-surface rounded w-1/4"></div>
      <div className="animate-pulse h-16 bg-surface rounded"></div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse h-16 bg-surface rounded"></div>
        ))}
      </div>
    </div>
  );
}

export default function TracesPage() {
  return (
    <div className="p-8">
      <Suspense fallback={<LoadingFallback />}>
        <TraceList />
      </Suspense>
    </div>
  );
}
