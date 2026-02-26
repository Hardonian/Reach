"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Trace {
  id: string;
  run_id: string;
  workflow_id?: string;
  workflow_name?: string;
  gate_id?: string;
  gate_name?: string;
  trace_type: string;
  status: string;
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
  input?: string;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
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

function StepIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    llm: "🧠",
    tool: "🔧",
    decision: "🤔",
    gate: "🚧",
    error: "❌",
  };
  return <span className="text-xl">{icons[type] || "📋"}</span>;
}

function StepTimeline({ steps, selectedStep, onSelectStep }: { 
  steps: TraceStep[]; 
  selectedStep: string | null;
  onSelectStep: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <button
          key={step.id}
          onClick={() => onSelectStep(step.id)}
          className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors ${
            selectedStep === step.id
              ? "bg-accent/10 border border-accent/30"
              : "bg-surface/50 hover:bg-surface border border-transparent"
          }`}
        >
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
              step.status === "failed" ? "bg-red-500/20 text-red-400" :
              step.status === "running" ? "bg-blue-500/20 text-blue-400" :
              "bg-gray-500/20 text-gray-400"
            }`}>
              {step.step_number}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-0.5 h-6 mt-1 ${
                step.status === "completed" ? "bg-emerald-500/30" :
                step.status === "failed" ? "bg-red-500/30" :
                "bg-gray-500/30"
              }`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StepIcon type={step.type} />
              <span className="font-medium truncate">{step.name}</span>
              <StatusBadge status={step.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
              {step.duration_ms && <span>{step.duration_ms}ms</span>}
              {step.started_at && (
                <span>{new Date(step.started_at).toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StepDetails({ step }: { step: TraceStep }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StepIcon type={step.type} />
          <div>
            <h3 className="font-semibold">{step.name}</h3>
            <p className="text-sm text-gray-400">Step {step.step_number}</p>
          </div>
        </div>
        <StatusBadge status={step.status} />
      </div>

      {step.duration_ms && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface/50 rounded p-3">
            <p className="text-xs text-gray-500 uppercase">Duration</p>
            <p className="font-mono">{step.duration_ms}ms</p>
          </div>
          {step.started_at && (
            <div className="bg-surface/50 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Started</p>
              <p className="font-mono text-sm">{new Date(step.started_at).toLocaleTimeString()}</p>
            </div>
          )}
          {step.finished_at && (
            <div className="bg-surface/50 rounded p-3">
              <p className="text-xs text-gray-500 uppercase">Finished</p>
              <p className="font-mono text-sm">{new Date(step.finished_at).toLocaleTimeString()}</p>
            </div>
          )}
        </div>
      )}

      {step.input && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Input</h4>
          <pre className="bg-surface rounded p-3 text-sm overflow-auto max-h-48">
            <code>{step.input}</code>
          </pre>
        </div>
      )}

      {step.output && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Output</h4>
          <pre className="bg-surface rounded p-3 text-sm overflow-auto max-h-48">
            <code>{step.output}</code>
          </pre>
        </div>
      )}

      {step.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            Error
          </h4>
          <pre className="text-sm text-red-300 whitespace-pre-wrap">{step.error}</pre>
        </div>
      )}

      {step.metadata && Object.keys(step.metadata).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Metadata</h4>
          <div className="bg-surface/50 rounded p-3">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(step.metadata).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-gray-500">{key}</dt>
                  <dd className="font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraceDetailPage() {
  const params = useParams();
  const traceId = params.id as string;
  
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrace();
  }, [traceId]);

  async function fetchTrace() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/traces/${traceId}`);
      if (!res.ok) throw new Error("Failed to load trace");
      const data = await res.json();
      setTrace(data.trace);
      if (data.trace.steps.length > 0) {
        setSelectedStepId(data.trace.steps[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trace");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-96 bg-surface rounded"></div>
            <div className="h-96 bg-surface rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="p-8">
        <div className="card border-red-500/30 bg-red-500/5">
          <h2 className="text-lg font-semibold text-red-400 mb-2">Failed to Load Trace</h2>
          <p className="text-gray-400">{error || "Trace not found"}</p>
          <button onClick={fetchTrace} className="btn-secondary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const selectedStep = trace.steps.find(s => s.id === selectedStepId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/console/traces" className="hover:text-accent">
            Traces
          </Link>
          <span>/</span>
          <span className="text-white">{trace.id}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {trace.workflow_name || trace.gate_name || "Trace Details"}
            </h1>
            <p className="text-gray-400 text-sm">
              Run ID: <code className="text-accent">{trace.run_id}</code>
            </p>
          </div>
          <StatusBadge status={trace.status} />
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Type</p>
          <p className="font-medium capitalize">{trace.trace_type}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Started</p>
          <p className="font-medium">{new Date(trace.started_at).toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Duration</p>
          <p className="font-medium">
            {trace.duration_ms ? `${(trace.duration_ms / 1000).toFixed(2)}s` : "Running..."}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Steps</p>
          <p className="font-medium">{trace.steps.length}</p>
        </div>
      </div>

      {/* Cost metadata */}
      {(trace.metadata.cost_usd || trace.metadata.input_tokens || trace.metadata.output_tokens) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {trace.metadata.cost_usd && (
            <div className="card bg-emerald-500/5 border-emerald-500/20">
              <p className="text-xs text-emerald-500/70 uppercase">Cost</p>
              <p className="font-mono text-emerald-400">${trace.metadata.cost_usd.toFixed(4)}</p>
            </div>
          )}
          {trace.metadata.input_tokens && (
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">Input Tokens</p>
              <p className="font-mono">{trace.metadata.input_tokens.toLocaleString()}</p>
            </div>
          )}
          {trace.metadata.output_tokens && (
            <div className="card">
              <p className="text-xs text-gray-500 uppercase">Output Tokens</p>
              <p className="font-mono">{trace.metadata.output_tokens.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}

      {/* Trace Timeline */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Execution Timeline</h2>
          <StepTimeline
            steps={trace.steps}
            selectedStep={selectedStepId}
            onSelectStep={setSelectedStepId}
          />
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Step Details</h2>
          {selectedStep ? (
            <StepDetails step={selectedStep} />
          ) : (
            <p className="text-gray-400 text-center py-8">
              Select a step to view details
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
