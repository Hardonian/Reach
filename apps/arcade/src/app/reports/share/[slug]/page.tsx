"use client";

/**
 * Public shared report — read-only, no login required.
 * Purpose: Share gate/simulation results with external stakeholders.
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface SharedReport {
  type: "gate_run" | "scenario_run";
  id: string;
  status: string;
  report?: {
    verdict: string;
    pass_rate: number;
    violations: number;
    findings: Array<{
      rule: string;
      severity: string;
      message: string;
      fix: string;
    }>;
    summary: string;
  };
  results?: Array<{
    variant_id: string;
    variant_label: string;
    status: string;
    latency_ms: number;
    pass_rate: number;
    cost_usd: number;
  }>;
  recommendation?: string | null;
  created_at: string;
  finished_at: string | null;
  share_expires_at: string | null;
}

export default function SharedReportPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/v1/reports/share/${slug}`)
      .then((r) => {
        if (r.status === 404) throw new Error("not_found");
        return r.json();
      })
      .then((d) => {
        setReport(d as SharedReport);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [slug]);

  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading shared report…</span>
      </div>
    );

  if (notFound || !report)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <span className="material-symbols-outlined text-4xl text-gray-600">
          link_off
        </span>
        <p className="text-white font-medium">
          Share link not found or expired
        </p>
        <a href="/" className="text-sm text-accent underline">
          Go to ReadyLayer
        </a>
      </div>
    );

  const isGate = report.type === "gate_run";
  const verdict = report.report?.verdict ?? report.status;
  const passed = verdict === "passed";

  return (
    <div className="min-h-screen bg-background py-10 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            ReadyLayer
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-xs text-gray-500">
            Shared {isGate ? "Gate Report" : "Simulation Report"}
          </span>
        </div>

        {/* Verdict */}
        {isGate && report.report && (
          <div
            className={`flex items-center gap-4 p-5 rounded-2xl border mb-6 ${
              passed
                ? "border-green-500/30 bg-green-500/5"
                : "border-orange-500/30 bg-orange-500/5"
            }`}
          >
            <span
              className={`material-symbols-outlined text-3xl ${passed ? "text-green-400" : "text-orange-400"}`}
            >
              {passed ? "check_circle" : "warning"}
            </span>
            <div>
              <p
                className={`text-base font-bold ${passed ? "text-green-400" : "text-orange-400"}`}
              >
                {passed ? "PASSED" : "NEEDS ATTENTION"}
              </p>
              <p className="text-sm text-gray-300 mt-0.5">
                {report.report.summary}
              </p>
            </div>
          </div>
        )}

        {/* Gate findings */}
        {isGate && report.report?.findings?.length ? (
          <div className="flex flex-col gap-3 mb-6">
            {report.report.findings.map((f, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${
                  f.severity === "error"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-orange-500/20 bg-orange-500/5"
                }`}
              >
                <p className="text-sm font-medium text-white mb-1">{f.rule}</p>
                <p className="text-sm text-gray-300 mb-1">{f.message}</p>
                <p className="text-xs text-gray-400">
                  <span className="text-gray-500">Fix: </span>
                  {f.fix}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Simulation results */}
        {!isGate && report.results?.length ? (
          <>
            {report.recommendation && (
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 text-sm text-gray-300 mb-4">
                {report.recommendation}
              </div>
            )}
            <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
              <thead className="border-b border-border bg-surface">
                <tr>
                  {["Variant", "Status", "Pass rate", "Latency", "Cost"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`py-2 px-4 text-xs text-gray-400 ${h === "Variant" ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {report.results.map((r) => (
                  <tr
                    key={r.variant_id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2 px-4 text-white">{r.variant_label}</td>
                    <td className="py-2 px-4 text-right">
                      <span
                        className={`text-xs ${r.status === "passed" ? "text-green-400" : "text-red-400"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-gray-300">
                      {(r.pass_rate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 px-4 text-right text-gray-300">
                      {r.latency_ms}ms
                    </td>
                    <td className="py-2 px-4 text-right text-gray-300">
                      ${r.cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {/* Footer */}
        <div className="mt-8 text-xs text-gray-600 text-center">
          Report generated {new Date(report.created_at).toLocaleDateString()}
          {report.share_expires_at
            ? ` · Expires ${new Date(report.share_expires_at).toLocaleDateString()}`
            : ""}
          {" · "}
          <a
            href="https://readylayer.com"
            className="text-gray-500 hover:text-gray-400"
          >
            ReadyLayer
          </a>
        </div>
      </div>
    </div>
  );
}
