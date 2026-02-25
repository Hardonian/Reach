import React from "react";
import { getFounderMetrics, getDecisions } from "@/lib/db/founder";

interface Decision {
  id: string;
  title: string;
  description: string;
  score_total: number;
  strategic_align: boolean;
  status: "go" | "kill" | "pending";
}

export default async function FounderDashboardPage() {
  const metrics = getFounderMetrics();
  const decisions = getDecisions() as Decision[];

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-end border-b border-arcade-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Founder Control System</h1>
          <p className="text-arcade-text-secondary mt-1">
            Status: Operational · Anti-Entropy Active
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-arcade-text-tertiary uppercase">Next Audit In</div>
          <div className="text-xl font-bold text-arcade-accent">42:15:08</div>
        </div>
      </header>

      {/* SECTION 1: WEEKLY DASHBOARD */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MTTFS"
          value={`${metrics.activation.mttfsMinutes}m`}
          sub="Median Time to Success"
          trend="-12% vs last week"
          status="good"
        />
        <MetricCard
          label="Gate Saturation"
          value={`${metrics.adoption.tenantsWithGates}`}
          sub="Workspaces with active gates"
          trend="+5 new"
          status="neutral"
        />
        <MetricCard
          label="Demo Conversion"
          value={`${Math.round((metrics.activation.signups / metrics.activation.demoRuns) * 100)}%`}
          sub="Demo → Signup"
          trend="+2.1%"
          status="good"
        />
        <MetricCard
          label="AHA! Moment"
          value={`${metrics.activation.firstPasses}`}
          sub="First Success achieved"
          trend="+18%"
          status="good"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SECTION 2: RED FLAGS */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Entropy & Complexity Drift
          </h2>
          <div className="space-y-4">
            <DriftSignal label="Route Bloat" value="12/15" limit="15" status="warning" />
            <DriftSignal label="UI Action Density" value="2.8" limit="3.0" status="good" />
            <DriftSignal label="Paragraph Violations" value="0" limit="0" status="good" />
            <DriftSignal label="Orphan Routes" value="1" limit="0" status="warning" />
          </div>

          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
            <h3 className="text-red-400 font-bold text-sm uppercase">Active Alert</h3>
            <p className="text-xs text-arcade-text-secondary mt-1">
              "Orphan Route Found: `/console/ecosystem/repo-sync`. Deprecation recommended by
              Friday."
            </p>
          </div>
        </div>

        {/* SECTION 7: DECISION LEDGER */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex justify-between items-center">
            Founder Decision Framework
            <button className="btn-secondary text-xs px-3 py-1">New Proposal</button>
          </h2>
          <div className="bg-arcade-surface border border-arcade-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-arcade-surface-hover border-b border-arcade-border">
                <tr>
                  <th className="px-4 py-3 font-medium text-arcade-text-secondary">Proposal</th>
                  <th className="px-4 py-3 font-medium text-arcade-text-secondary text-center">
                    Score
                  </th>
                  <th className="px-4 py-3 font-medium text-arcade-text-secondary">Alignment</th>
                  <th className="px-4 py-3 font-medium text-arcade-text-secondary">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arcade-border">
                {decisions.map((dec: Decision) => (
                  <tr key={dec.id} className="hover:bg-arcade-surface-hover transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-bold text-white">{dec.title}</div>
                      <div className="text-xs text-arcade-text-tertiary truncate max-w-xs">
                        {dec.description}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`px-2 py-1 rounded font-mono text-xs ${dec.score_total > 25 ? "bg-emerald-500/20 text-emerald-400" : "bg-arcade-accent/20 text-arcade-accent"}`}
                      >
                        {Math.round(dec.score_total)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {dec.strategic_align ? (
                        <span className="text-emerald-400 text-xs">✓ Aligned</span>
                      ) : (
                        <span className="text-red-500/50 text-xs italic">⚠ Drift Potential</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs font-bold uppercase">
                      <span
                        className={
                          dec.status === "go"
                            ? "text-emerald-400"
                            : dec.status === "kill"
                              ? "text-red-400"
                              : "text-arcade-text-tertiary"
                        }
                      >
                        {dec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
  trend: string;
  status: "good" | "neutral" | "warning";
}

function MetricCard({ label, value, sub, trend, status }: MetricCardProps) {
  return (
    <div className="bg-arcade-surface border border-arcade-border p-5 rounded-xl space-y-2 group hover:border-arcade-primary/50 transition-all">
      <div className="text-xs font-mono text-arcade-text-secondary uppercase">{label}</div>
      <div className="text-3xl font-bold tracking-tighter text-white">{value}</div>
      <div className="flex justify-between items-center text-[10px] font-medium">
        <span className="text-arcade-text-tertiary">{sub}</span>
        <span className={status === "good" ? "text-emerald-400" : "text-arcade-accent"}>
          {trend}
        </span>
      </div>
    </div>
  );
}

interface DriftSignalProps {
  label: string;
  value: string;
  limit: string;
  status: "good" | "warning";
}

function DriftSignal({ label, value, limit, status }: DriftSignalProps) {
  const percent = Math.min((parseFloat(value) / parseFloat(limit)) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-arcade-text-secondary">{label}</span>
        <span className={status === "warning" ? "text-arcade-accent" : "text-emerald-400"}>
          {value} / {limit}
        </span>
      </div>
      <div
        {...({
          role: "progressbar",
          "aria-valuenow": Math.round(percent),
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-label": label,
        } as React.HTMLAttributes<HTMLDivElement>)}
        className="h-1.5 bg-arcade-surface-hover rounded-full overflow-hidden border border-arcade-border"
      >
        <svg width="100%" height="100%" preserveAspectRatio="none" className="block">
          <rect
            width={`${percent}%`}
            height="100%"
            className={`transition-all duration-1000 ${status === "warning" ? "fill-(--arcade-accent)" : "fill-emerald-500"}`}
          />
        </svg>
      </div>
    </div>
  );
}
