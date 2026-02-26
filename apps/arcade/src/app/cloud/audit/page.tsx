"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resourceType: string;
  status: "success" | "failure" | "blocked";
  details: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditResponse {
  events: AuditEvent[];
  limit: number;
  offset: number;
  total: number;
}

const ACTION_FILTERS = [
  { value: "", label: "All Actions" },
  { value: "api_key.create", label: "API Key Created" },
  { value: "api_key.revoke", label: "API Key Revoked" },
  { value: "policy.created", label: "Policy Created" },
  { value: "policy.updated", label: "Policy Updated" },
  { value: "policy.deleted", label: "Policy Deleted" },
  { value: "policy.rollback", label: "Policy Rolled Back" },
  { value: "gate.created", label: "Gate Created" },
  { value: "gate.updated", label: "Gate Updated" },
  { value: "auth.login", label: "Login" },
  { value: "auth.logout", label: "Logout" },
  { value: "user.created", label: "User Created" },
  { value: "workflow.run", label: "Workflow Run" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
  { value: "blocked", label: "Blocked" },
];

function LoadingState() {
  return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-surface rounded w-1/4"></div>
        <div className="h-12 bg-surface rounded"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
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
        <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Audit Log</h2>
        <p className="text-gray-400 text-sm mb-4">{error}</p>
        <button onClick={retry} className="btn-secondary text-sm">
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState({ clearFilters }: { clearFilters: () => void }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-4">📋</div>
      <h3 className="text-lg font-semibold mb-2">No Audit Events Found</h3>
      <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
        No audit events match your current filters. Try adjusting your search or filters, or check back later.
      </p>
      <button onClick={clearFilters} className="btn-secondary">
        Clear Filters
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: AuditEvent["status"] }) {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400",
    failure: "bg-red-500/10 text-red-400",
    blocked: "bg-amber-500/10 text-amber-400",
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}

// Export audit log to CSV
function exportToCSV(events: AuditEvent[], filename = "audit-log.csv") {
  const headers = ["Timestamp", "Actor", "Action", "Resource", "Resource Type", "Status", "Details", "IP Address"];
  const rows = events.map((e) => [
    e.timestamp,
    e.actor,
    e.action,
    e.resource,
    e.resourceType,
    e.status,
    e.details,
    e.ipAddress || "",
  ]);
  
  const csv = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
  
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [actionFilter, setActionFilter] = useState(searchParams.get("action") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [actorFilter, setActorFilter] = useState(searchParams.get("actor") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("from") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("to") || "");
  
  const [exporting, setExporting] = useState(false);

  const fetchAuditLog = useCallback(async (currentOffset = offset) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(currentOffset));
      if (actionFilter) params.set("action", actionFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (actorFilter) params.set("actor", actorFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      
      const res = await fetch(`/api/v1/audit?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit log: ${res.statusText}`);
      }
      
      const data: AuditResponse = await res.json();
      setEvents(data.events);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, statusFilter, actorFilter, dateFrom, dateTo, offset, limit]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  // Update URL when filters change
  const updateFilters = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (actionFilter) params.set("action", actionFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    
    router.replace(`/cloud/audit?${params.toString()}`, { scroll: false });
    setOffset(0);
    fetchAuditLog(0);
  }, [searchQuery, actionFilter, statusFilter, actorFilter, dateFrom, dateTo, router, fetchAuditLog]);

  const clearFilters = () => {
    setSearchQuery("");
    setActionFilter("");
    setStatusFilter("");
    setActorFilter("");
    setDateFrom("");
    setDateTo("");
    setOffset(0);
    router.replace("/cloud/audit");
    fetchAuditLog(0);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch all events for export (up to 1000)
      const params = new URLSearchParams();
      params.set("limit", "1000");
      params.set("offset", "0");
      if (actionFilter) params.set("action", actionFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (actorFilter) params.set("actor", actorFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      
      const res = await fetch(`/api/v1/audit?${params.toString()}`);
      if (res.ok) {
        const data: AuditResponse = await res.json();
        exportToCSV(data.events, `audit-log-${new Date().toISOString().split("T")[0]}.csv`);
      }
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (loading && events.length === 0) return <LoadingState />;
  if (error) return <ErrorState error={error} retry={() => fetchAuditLog()} />;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-gray-400 text-sm">
            Track all actions across your organization • {total.toLocaleString()} events
          </p>
        </div>
        <button 
          onClick={handleExport}
          disabled={exporting || events.length === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateFilters()}
              className="w-full px-4 py-2 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Actor (email)"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && updateFilters()}
            className="px-4 py-2 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
          />
          <button onClick={updateFilters} className="btn-primary">
            Apply Filters
          </button>
          {(actionFilter || statusFilter || actorFilter || searchQuery) && (
            <button onClick={clearFilters} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 rounded bg-surface border border-border text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Events Table */}
      {events.length === 0 ? (
        <EmptyState clearFilters={clearFilters} />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Resource</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface/50">
                    <td className="py-3 px-4 text-sm font-mono text-gray-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm">{event.actor}</td>
                    <td className="py-3 px-4">
                      <code className="text-xs px-2 py-1 rounded bg-surface text-accent">
                        {event.action}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span className="text-gray-500 text-xs block">{event.resourceType}</span>
                      {event.resource}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={event.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400 max-w-xs truncate">
                      {event.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-400">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newOffset = Math.max(0, offset - limit);
                    setOffset(newOffset);
                    fetchAuditLog(newOffset);
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
                    fetchAuditLog(newOffset);
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
