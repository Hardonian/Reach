"use client";

import React, { useState } from "react";
import { ReasonForChangeModal } from "@/components/stitch/shared/ReasonForChangeModal";

export function GovernanceCompliance() {
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "security" | "network">("all");
  const [providerFilter, setProviderFilter] = useState<"all" | "dgl" | "cpx" | "sccl">("all");
  const [strictMode, setStrictMode] = useState(false);

  const rawViolations = [
    {
      title: "Critical: Unencrypted Storage",
      time: "2m ago",
      desc: "Deployment deploy-883a violates encryption policy.",
      severity: "critical" as const,
      type: "security" as const,
      provider: "dgl" as const,
    },
    {
      title: "Warning: Open Port 22",
      time: "15m ago",
      desc: "Service bastion-host exposes SSH to public internet.",
      severity: "warning" as const,
      type: "network" as const,
      provider: "sccl" as const,
    },
    {
      title: "Critical: Root Access",
      time: "1h ago",
      desc: "Container runner-04 running as root user.",
      severity: "critical" as const,
      type: "security" as const,
      provider: "cpx" as const,
    },
    {
      title: "Critical: Root Access",
      time: "1h ago",
      desc: "Container runner-04 running as root user.",
      severity: "critical" as const,
      type: "security" as const,
      provider: "dgl" as const,
    },
  ];

  function handleFreezeConfirm(reason: string) {
    setNotice(`Emergency freeze requested. Reason captured for audit: "${reason}"`);
    setFreezeModalOpen(false);
  }

  const dedupedViolations = rawViolations.filter(
    (item, index, all) => all.findIndex((candidate) => candidate.title === item.title) === index,
  );
  const filteredViolations = dedupedViolations.filter((item) => {
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (providerFilter !== "all" && item.provider !== providerFilter) return false;
    return true;
  });
  const primaryViolation = filteredViolations[0] ?? null;
  const relatedViolations = primaryViolation ? filteredViolations.slice(1) : [];

  async function copyCommand(command: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(command);
      setNotice(`Copied command: ${command}`);
    } catch {
      setNotice(`Copy failed. Command: ${command}`);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#111318]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#2d3442] bg-[#111318] px-8 py-4 shrink-0 z-10 font-sans">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[#9da6b9] text-sm">
            <span>Console</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-white font-medium">Governance & Policy</span>
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">Security & Compliance</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-[#1c1f27] px-3 py-1.5 rounded-lg border border-[#2d3442]">
            <span className="material-symbols-outlined text-[#9da6b9]">apartment</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#9da6b9] font-medium uppercase tracking-wider">
                Tenant Scope
              </span>
              <select className="bg-transparent text-sm font-medium text-white border-none p-0 focus:ring-0 cursor-pointer outline-none">
                <option>Production (US-East)</option>
                <option>Staging (EU-West)</option>
                <option>Development</option>
              </select>
            </div>
          </div>
          <div className="h-8 w-px bg-[#2d3442] mx-2"></div>
          <button
            type="button"
            onClick={() => setFreezeModalOpen(true)}
            className="group flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/30 rounded-lg transition-all duration-200"
          >
            <span className="material-symbols-outlined group-hover:animate-pulse text-[20px]">
              lock
            </span>
            <span className="font-bold text-sm">Emergency Freeze</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 scroll-smooth scrollbar-hide">
        <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
          {notice ? (
            <div className="rounded-lg border border-[#135bec]/40 bg-[#135bec]/10 px-4 py-3 text-sm text-[#d8e3ff]">
              {notice}
            </div>
          ) : null}
          <div className="rounded-xl border border-[#2d3442] bg-[#1c1f27] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs uppercase tracking-wide text-[#9da6b9]">Severity</label>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}
                className="rounded border border-[#2d3442] bg-[#111318] px-2 py-1 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
              </select>
              <label className="text-xs uppercase tracking-wide text-[#9da6b9]">Type</label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
                className="rounded border border-[#2d3442] bg-[#111318] px-2 py-1 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="security">Security</option>
                <option value="network">Network</option>
              </select>
              <label className="text-xs uppercase tracking-wide text-[#9da6b9]">Provider</label>
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value as typeof providerFilter)}
                className="rounded border border-[#2d3442] bg-[#111318] px-2 py-1 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="dgl">DGL</option>
                <option value="cpx">CPX</option>
                <option value="sccl">SCCL</option>
              </select>
              <button
                type="button"
                onClick={() => setStrictMode((v) => !v)}
                className={`ml-auto rounded border px-3 py-1 text-xs font-semibold ${
                  strictMode
                    ? "border-red-500/50 bg-red-500/20 text-red-200"
                    : "border-[#2d3442] bg-[#111318] text-[#9da6b9]"
                }`}
              >
                Strict Mode: {strictMode ? "ON" : "OFF"}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#9da6b9]">
              Warnings stay non-blocking unless strict mode is enabled.
            </p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* RBAC Matrix */}
            <div className="xl:col-span-2 bg-[#1c1f27] border border-[#2d3442] rounded-xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-[#2d3442] flex justify-between items-center bg-[#282e39]/30">
                <div>
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#135bec]">
                      admin_panel_settings
                    </span>
                    Role-Based Access Control (RBAC)
                  </h3>
                  <p className="text-[#9da6b9] text-xs mt-1">
                    Permission matrix for the current tenant scope.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[#135bec] text-sm font-medium hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span> Edit Roles
                </button>
                <button
                  type="button"
                  onClick={() => void copyCommand("./reach status")}
                  className="text-[#9da6b9] text-sm font-medium hover:text-white flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">content_copy</span>
                  Copy CLI
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2d3442] text-xs uppercase text-[#9da6b9] font-medium bg-[#282e39]/20">
                      <th className="px-6 py-3 min-w-[150px]">Resource / Role</th>
                      <th className="px-4 py-3 text-center">Admin</th>
                      <th className="px-4 py-3 text-center">DevOps</th>
                      <th className="px-4 py-3 text-center">Viewer</th>
                      <th className="px-4 py-3 text-center">Auditor</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-[#2d3442]">
                    {[
                      {
                        res: "Deployments",
                        roles: ["check", "check", "view", "view"],
                      },
                      {
                        res: "Secrets Manager",
                        roles: ["check", "edit", "none", "none"],
                      },
                      {
                        res: "Audit Logs",
                        roles: ["check", "view", "none", "view"],
                      },
                      {
                        res: "Billing",
                        roles: ["check", "none", "none", "none"],
                      },
                    ].map((row) => (
                      <tr key={row.res} className="hover:bg-[#282e39]/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{row.res}</td>
                        {row.roles.map((role, i) => (
                          <td key={i} className="px-4 py-4 text-center">
                            {role === "check" && (
                              <span className="material-symbols-outlined text-[#10b981] text-[20px]">
                                check_circle
                              </span>
                            )}
                            {role === "view" && (
                              <span className="material-symbols-outlined text-[#9da6b9] text-[20px]">
                                visibility
                              </span>
                            )}
                            {role === "edit" && (
                              <span className="material-symbols-outlined text-amber-500 text-[20px]">
                                edit
                              </span>
                            )}
                            {role === "none" && (
                              <span className="material-symbols-outlined text-[#2d3442] text-[20px]">
                                remove
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Build Gate Violations */}
            <div className="xl:col-span-1 bg-[#1c1f27] border border-[#2d3442] rounded-xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-[#2d3442] flex justify-between items-center bg-[#282e39]/30">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500">gpp_bad</span>
                  Build Gate Violations
                </h3>
                <span className="bg-red-500/20 text-red-500 text-xs font-bold px-2 py-0.5 rounded">
                  {filteredViolations.length} Active
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {primaryViolation ? (
                  <div className="rounded-lg border border-red-500/30 bg-[#282e39]/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-red-400">
                        {primaryViolation.title}
                      </span>
                      <span className="text-[10px] text-[#9da6b9]">{primaryViolation.time}</span>
                    </div>
                    <p className="mt-2 text-xs text-[#d0d7e7]">{primaryViolation.desc}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wide text-[#9da6b9]">
                      Primary reason ({primaryViolation.provider.toUpperCase()})
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-[#2d3442] bg-[#111318] p-4 text-sm text-[#9da6b9]">
                    No active violations for current filters.
                    <button
                      type="button"
                      onClick={() => void copyCommand("npm run verify:routes")}
                      className="ml-2 text-[#135bec] hover:underline"
                    >
                      Copy verify command
                    </button>
                  </div>
                )}
                {relatedViolations.map((v) => (
                  <div
                    key={v.title}
                    className="rounded-lg border border-amber-500/30 bg-[#282e39]/40 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">{v.title}</span>
                      <span className="text-[10px] text-[#9da6b9]">{v.provider.toUpperCase()}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#9da6b9]">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RLS Policy Viewer */}
          <div className="bg-[#1c1f27] border border-[#2d3442] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2d3442] flex justify-between items-center bg-[#282e39]/30">
              <div>
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#135bec]">security</span>
                  RLS Policy Viewer
                </h3>
                <p className="text-[#9da6b9] text-xs mt-1">
                  Row Level Security logic applied to database queries.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#2d3442]">
              {[
                {
                  title: "Tenant Isolation",
                  sql: "CREATE POLICY tenant_isolation_policy ON orders USING (tenant_id = app.current_tenant);",
                },
                {
                  title: "PII Access Control",
                  sql: "CREATE POLICY pii_access_policy ON users USING (auth.role() = 'admin' OR id = auth.uid());",
                },
              ].map((policy) => (
                <div key={policy.title} className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-[#135bec]/20 text-[#135bec] p-1.5 rounded-lg material-symbols-outlined text-[20px]">
                        database
                      </span>
                      <h4 className="text-white font-medium">{policy.title}</h4>
                    </div>
                    <span className="text-xs bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded-full border border-[#10b981]/20 font-bold">
                      Active
                    </span>
                  </div>
                  <div className="bg-[#0d1117] rounded-lg p-4 font-mono text-xs text-slate-300 border border-[#2d3442] overflow-x-auto">
                    <pre>
                      <code>{policy.sql}</code>
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Audit Timeline */}
          <div className="bg-[#1c1f27] border border-[#2d3442] rounded-xl overflow-hidden flex flex-col mb-8">
            <div className="px-6 py-4 border-b border-[#2d3442] flex flex-wrap justify-between items-center gap-4 bg-[#282e39]/30">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-[#135bec]">history_edu</span>
                Live Audit Timeline
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex bg-[#111318] rounded-lg border border-[#2d3442] p-0.5">
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md bg-[#282e39] text-white text-xs font-bold"
                  >
                    Real-time
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-md text-[#9da6b9] hover:text-white text-xs font-medium"
                  >
                    Past 24h
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs text-[#9da6b9] bg-[#282e39]/20 border-b border-[#2d3442]">
                    <th className="px-6 py-3 font-medium">Timestamp</th>
                    <th className="px-6 py-3 font-medium">Actor</th>
                    <th className="px-6 py-3 font-medium">Action</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-[#2d3442] text-slate-300">
                  {[
                    {
                      time: "14:32:01",
                      user: "m.keaton@reach.ai",
                      initial: "MK",
                      action: "Update Policy",
                      status: "Success",
                    },
                    {
                      time: "14:30:15",
                      user: "system-bot",
                      initial: "SY",
                      action: "Auto-Scale Trigger",
                      status: "Success",
                    },
                    {
                      time: "14:15:42",
                      user: "j.doe@reach.ai",
                      initial: "JD",
                      action: "Delete Secret",
                      status: "Denied",
                    },
                  ].map((log) => (
                    <tr key={log.time} className="hover:bg-[#282e39]/20 transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs text-[#9da6b9]">
                        2023-10-24 {log.time}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <div className="size-6 rounded-full bg-[#135bec]/20 text-[#135bec] flex items-center justify-center text-[10px] font-bold">
                          {log.initial}
                        </div>
                        <span className="text-white">{log.user}</span>
                      </td>
                      <td className="px-6 py-4 font-medium">{log.action}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${log.status === "Success" ? "bg-[#10b981]/10 text-[#10b981]" : "bg-red-500/10 text-red-500"}`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <ReasonForChangeModal
        isOpen={freezeModalOpen}
        onClose={() => setFreezeModalOpen(false)}
        onConfirm={handleFreezeConfirm}
        actionName="Emergency System Freeze"
      />
    </div>
  );
}
