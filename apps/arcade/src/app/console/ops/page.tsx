"use client";

import React, { useState } from "react";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";
import { DegradedBanner } from "@/components/DegradedBanner";
import type { SystemMode } from "@/lib/viewmodels/system-status";

interface OpsToggle {
  id: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  adminOnly: true;
}

export default function OpsPage() {
  const [systemMode] = useState<SystemMode>("normal");
  const [toggles, setToggles] = useState<OpsToggle[]>([
    {
      id: "queue-pause",
      label: "Pause Queue",
      description: "Halt all new job processing. Running jobs will complete.",
      icon: "pause_circle",
      enabled: false,
      adminOnly: true,
    },
    {
      id: "circuit-breaker",
      label: "Circuit Breaker",
      description: "Open the circuit breaker to stop outgoing model calls.",
      icon: "electric_bolt",
      enabled: false,
      adminOnly: true,
    },
    {
      id: "rate-limit",
      label: "Rate Limiting",
      description: "Enforce stricter rate limits on incoming requests.",
      icon: "speed",
      enabled: false,
      adminOnly: true,
    },
  ]);
  const [concurrencyCap, setConcurrencyCap] = useState(50);
  const [auditLog, setAuditLog] = useState<
    Array<{ time: string; action: string; user: string }>
  >([]);

  const handleToggle = (id: string) => {
    setToggles((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, enabled: !t.enabled };
        setAuditLog((prev) => [
          {
            time: new Date().toISOString(),
            action: `${next.enabled ? "Enabled" : "Disabled"} ${next.label}`,
            user: "current-user",
          },
          ...prev,
        ]);
        return next;
      }),
    );
  };

  const isDegraded =
    systemMode === "degraded" || toggles.some((t) => t.enabled);

  return (
    <ConsoleLayout>
      <DegradedBanner visible={isDegraded} />
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Operations Controls
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Admin-only controls for system safety. All changes are audited.
          </p>
        </div>

        {/* System Mode Indicator */}
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            isDegraded
              ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
              : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[24px] ${isDegraded ? "text-amber-600" : "text-emerald-600"}`}
          >
            {isDegraded ? "warning" : "check_circle"}
          </span>
          <div>
            <span
              className={`text-sm font-bold uppercase tracking-wider ${isDegraded ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}
            >
              System: {isDegraded ? "Degraded" : "Normal"}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              {isDegraded
                ? "One or more safety controls are active. Mutating actions may be restricted."
                : "All systems operating normally."}
            </p>
          </div>
        </div>

        {/* Toggle Controls */}
        <div className="flex flex-col gap-4 mb-8">
          {toggles.map((toggle) => (
            <div
              key={toggle.id}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`material-symbols-outlined text-[24px] ${toggle.enabled ? "text-amber-500" : "text-slate-400"}`}
                >
                  {toggle.icon}
                </span>
                <div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {toggle.label}
                  </span>
                  <p className="text-xs text-slate-500">{toggle.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(toggle.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  toggle.enabled
                    ? "bg-amber-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
                role="switch"
                aria-checked={toggle.enabled}
                title="Admin only"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${toggle.enabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Concurrency Cap */}
        <div className="mb-8 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
            Concurrency Cap
          </h2>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={200}
              value={concurrencyCap}
              onChange={(e) => setConcurrencyCap(parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="text-sm font-mono text-slate-700 dark:text-slate-300 w-12 text-right">
              {concurrencyCap}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Maximum concurrent jobs allowed in the runner pool.
          </p>
        </div>

        {/* Audit Log */}
        {auditLog.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
              Session Audit Log
            </h2>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Time
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      Action
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">
                      User
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {auditLog.map((entry, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-slate-500">
                        {new Date(entry.time).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {entry.action}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{entry.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </ConsoleLayout>
  );
}
