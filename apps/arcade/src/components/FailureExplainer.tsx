"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface FailureExplanation {
  summary: string;
  root_cause: {
    type: "gate_failure" | "workflow_error" | "policy_violation" | "threshold_breach" | "unknown";
    description: string;
    failing_component: string;
  };
  details: {
    failing_rule?: string;
    expected_value?: string;
    actual_value?: string;
    error_message?: string;
    stack_trace?: string;
  };
  context: {
    run_id: string;
    gate_id?: string;
    workflow_id?: string;
    timestamp: string;
    duration_ms?: number;
  };
  recommendations: {
    immediate_action: string;
    fix_steps: string[];
    prevention_tips: string[];
    documentation_links: { label: string; url: string }[];
  };
  related_runs: {
    id: string;
    status: string;
    timestamp: string;
    similarity_score: number;
  }[];
}

interface FailureExplainerProps {
  reportId: string;
  status: "success" | "failed" | "error" | "blocked" | "running";
}

function RootCauseIcon({ type }: { type: FailureExplanation["root_cause"]["type"] }) {
  const icons = {
    gate_failure: "🚧",
    workflow_error: "⚙️",
    policy_violation: "🛡️",
    threshold_breach: "📉",
    unknown: "❓",
  };
  return <span className="text-2xl">{icons[type] || icons.unknown}</span>;
}

function RootCauseBadge({ type }: { type: FailureExplanation["root_cause"]["type"] }) {
  const styles = {
    gate_failure: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    workflow_error: "bg-red-500/10 text-red-400 border-red-500/20",
    policy_violation: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    threshold_breach: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    unknown: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  const labels = {
    gate_failure: "Gate Failure",
    workflow_error: "Workflow Error",
    policy_violation: "Policy Violation",
    threshold_breach: "Threshold Breach",
    unknown: "Unknown",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

export function FailureExplainer({ reportId, status }: FailureExplainerProps) {
  const [explanation, setExplanation] = useState<FailureExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isFailure = status === "failed" || status === "error" || status === "blocked";

  useEffect(() => {
    if (isFailure && expanded && !explanation && !loading) {
      fetchExplanation();
    }
  }, [expanded, isFailure]);

  async function fetchExplanation() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/reports/${reportId}/explain`);
      if (!res.ok) throw new Error("Failed to load explanation");
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load explanation");
    } finally {
      setLoading(false);
    }
  }

  if (!isFailure) return null;

  return (
    <div className="card border-red-500/20 bg-red-500/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
            <span className="material-symbols-outlined">lightbulb</span>
          </div>
          <div>
            <h3 className="font-semibold text-red-200">What Failed?</h3>
            <p className="text-sm text-red-300/70">
              {expanded ? "Click to collapse" : "Click for root cause analysis and fix steps"}
            </p>
          </div>
        </div>
        <span className={`material-symbols-outlined transition-transform ${expanded ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-red-500/10 pt-4">
          {loading && (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-surface rounded w-3/4"></div>
              <div className="h-20 bg-surface rounded"></div>
              <div className="h-16 bg-surface rounded"></div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm">
              Failed to load explanation: {error}
              <button onClick={fetchExplanation} className="ml-2 text-accent hover:underline">
                Retry
              </button>
            </div>
          )}

          {explanation && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="flex items-start gap-3">
                <RootCauseIcon type={explanation.root_cause.type} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <RootCauseBadge type={explanation.root_cause.type} />
                    <span className="text-xs text-gray-500">
                      {explanation.context.timestamp && new Date(explanation.context.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white font-medium">{explanation.summary}</p>
                </div>
              </div>

              {/* Technical Details */}
              {explanation.details.failing_rule && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Failing Rule</h4>
                  <code className="text-sm text-accent">{explanation.details.failing_rule}</code>
                  {explanation.details.expected_value && explanation.details.actual_value && (
                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Expected:</span>
                        <span className="ml-2 text-emerald-400">{explanation.details.expected_value}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Actual:</span>
                        <span className="ml-2 text-red-400">{explanation.details.actual_value}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {explanation.details.error_message && (
                <div className="bg-surface/50 rounded-lg p-3">
                  <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Error Message</h4>
                  <pre className="text-sm text-red-300 whitespace-pre-wrap">{explanation.details.error_message}</pre>
                </div>
              )}

              {/* Immediate Action */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <h4 className="flex items-center gap-2 font-medium text-amber-200 mb-2">
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  Immediate Action Required
                </h4>
                <p className="text-sm text-amber-100/80">{explanation.recommendations.immediate_action}</p>
              </div>

              {/* Fix Steps */}
              {explanation.recommendations.fix_steps.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Fix Steps</h4>
                  <ol className="space-y-2">
                    {explanation.recommendations.fix_steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-gray-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Prevention Tips */}
              {explanation.recommendations.prevention_tips.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4">
                  <h4 className="flex items-center gap-2 font-medium text-emerald-200 mb-2">
                    <span className="material-symbols-outlined text-[18px]">shield</span>
                    Prevention Tips
                  </h4>
                  <ul className="space-y-1">
                    {explanation.recommendations.prevention_tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-emerald-100/70">
                        <span className="text-emerald-400">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Documentation Links */}
              {explanation.recommendations.documentation_links.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {explanation.recommendations.documentation_links.map((link, i) => (
                    <Link
                      key={i}
                      href={link.url}
                      className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 px-3 py-1.5 rounded bg-surface hover:bg-surface/80 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}

              {/* Context */}
              <div className="text-xs text-gray-500 pt-2 border-t border-border">
                Run ID: <code className="text-gray-400">{explanation.context.run_id}</code>
                {explanation.context.duration_ms && (
                  <span className="ml-4">Duration: {(explanation.context.duration_ms / 1000).toFixed(2)}s</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
