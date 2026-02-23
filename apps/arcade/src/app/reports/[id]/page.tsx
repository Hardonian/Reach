"use client";

/**
 * Canonical Report — shows gate run or simulation run results.
 * Purpose: Single source of truth for readiness/regression verdicts.
 * Primary action: Share or re-run.
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface GateReport {
  type: "gate_run";
  id: string;
  status: string;
  trigger_type: string;
  commit_sha: string | null;
  pr_number: number | null;
  branch: string | null;
  report: {
    verdict: "passed" | "failed";
    pass_rate: number;
    violations: number;
    findings: Array<{
      rule: string;
      severity: string;
      message: string;
      fix: string;
    }>;
    summary: string;
    report_url?: string;
  };
  created_at: string;
  finished_at: string | null;
}
interface SimReport {
  type: "scenario_run";
  id: string;
  status: string;
  results: Array<{
    variant_id: string;
    variant_label: string;
    status: string;
    latency_ms: number;
    pass_rate: number;
    cost_usd: number;
    error?: string;
  }>;
  recommendation: string | null;
  created_at: string;
  finished_at: string | null;
}
type Report = GateReport | SimReport;

function VerdictBanner({
  verdict,
  summary,
}: {
  verdict: "passed" | "failed" | string;
  summary: string;
}) {
  const passed = verdict === "passed";
  return (
    <div
      className={`flex items-center gap-4 p-5 rounded-2xl border ${
        passed ? "border-green-500/30 bg-green-500/5" : "border-orange-500/30 bg-orange-500/5"
      }`}
    >
      <span
        className={`material-symbols-outlined text-3xl ${passed ? "text-green-400" : "text-orange-400"}`}
      >
        {passed ? "check_circle" : "warning"}
      </span>
      <div>
        <p className={`text-base font-bold ${passed ? "text-green-400" : "text-orange-400"}`}>
          {passed ? "PASSED" : "NEEDS ATTENTION"}
        </p>
        <p className="text-sm text-gray-300 mt-0.5">{summary}</p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const params = useParams();
  const id = params?.id as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const res = await fetch(`/api/v1/reports/${id}`);
      if (res.ok) {
        const data = (await res.json()) as Report;
        setReport(data);
        setLoading(false);

        // Poll if still running
        if (data.status === "running") {
          const interval = setInterval(async () => {
            const r2 = await fetch(`/api/v1/reports/${id}`);
            if (r2.ok) {
              const d2 = (await r2.json()) as Report;
              setReport(d2);
              if (d2.status !== "running") clearInterval(interval);
            }
          }, 2000);
          setPolling(interval);
        }
      } else {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (polling) clearInterval(polling);
    };
  }, [id]);

  async function createShare() {
    if (!report) return;
    setSharing(true);
    const resourceType = report.type;
    const res = await fetch(`/api/v1/reports/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_type: resourceType,
        expires_in_seconds: 604800,
      }), // 7 days
    });
    if (res.ok) {
      const data = (await res.json()) as { share_link: string };
      setShareLink(data.share_link);
    }
    setSharing(false);
  }

  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading report…</span>
      </div>
    );

  if (!report)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-base font-medium">Report not found</p>
          <p className="text-gray-400 text-sm mt-1">
            This report may have expired or been deleted.
          </p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-background py-8 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
              {report.type === "gate_run" ? "Gate Report" : "Simulation Report"}
            </p>
            <h1 className="text-xl font-bold text-white font-mono">{id.slice(0, 20)}…</h1>
            {report.status === "running" && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <span className="animate-spin material-symbols-outlined text-[14px]">sync</span>{" "}
                Running…
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {shareLink ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
                <code className="text-xs text-accent">{shareLink}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(shareLink)}
                  className="text-gray-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            ) : (
              <button
                onClick={createShare}
                disabled={sharing}
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                {sharing ? "Sharing…" : "Share"}
              </button>
            )}
          </div>
        </div>

        {/* Gate Run report */}
        {report.type === "gate_run" && report.status !== "running" && (
          <>
            <VerdictBanner verdict={report.report.verdict} summary={report.report.summary} />

            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                <p className="text-xs text-gray-400">Pass rate</p>
                <p className="text-xl font-bold text-white">
                  {(report.report.pass_rate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                <p className="text-xs text-gray-400">Violations</p>
                <p
                  className={`text-xl font-bold ${report.report.violations > 0 ? "text-orange-400" : "text-white"}`}
                >
                  {report.report.violations}
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-surface text-center">
                <p className="text-xs text-gray-400">Trigger</p>
                <p className="text-sm font-medium text-white mt-0.5">{report.trigger_type}</p>
              </div>
            </div>

            {report.report.findings.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Findings
                </h2>
                <div className="flex flex-col gap-3">
                  {report.report.findings.map((f, i) => (
                    <div
                      key={i}
                      className={`p-4 rounded-xl border ${
                        f.severity === "error"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-orange-500/20 bg-orange-500/5"
                      }`}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <span
                          className={`material-symbols-outlined text-[16px] ${f.severity === "error" ? "text-red-400" : "text-orange-400"}`}
                        >
                          {f.severity === "error" ? "error" : "warning"}
                        </span>
                        <p className="text-sm font-medium text-white">{f.rule}</p>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{f.message}</p>
                      <p className="text-xs text-gray-400">
                        <span className="text-gray-500">Suggested fix: </span>
                        {f.fix}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.commit_sha && (
              <div className="mt-4 text-xs text-gray-500">
                Commit:{" "}
                <code className="font-mono text-gray-400">{report.commit_sha.slice(0, 8)}</code>
                {report.branch && (
                  <>
                    {" "}
                    · Branch: <code className="font-mono text-gray-400">{report.branch}</code>
                  </>
                )}
                {report.pr_number && <> · PR #{report.pr_number}</>}
              </div>
            )}
          </>
        )}

        {/* Simulation report */}
        {report.type === "scenario_run" && report.status !== "running" && (
          <>
            {report.recommendation && (
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 text-sm text-gray-300 mb-4">
                {report.recommendation}
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    {["Variant", "Status", "Pass rate", "Latency", "Cost"].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-medium text-gray-400 ${h === "Variant" ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((r) => (
                    <tr key={r.variant_id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 px-4 text-white font-medium">{r.variant_label}</td>
                      <td className="py-2 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            r.status === "passed"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-right text-gray-300">
                        {(r.pass_rate * 100).toFixed(0)}%
                      </td>
                      <td className="py-2 px-4 text-right text-gray-300">{r.latency_ms}ms</td>
                      <td className="py-2 px-4 text-right text-gray-300">
                        ${r.cost_usd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {report.status === "running" && (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
            <span className="animate-spin material-symbols-outlined text-[20px]">sync</span>
            Report is being generated…
          </div>
        )}
      </div>
    </div>
  );
}
