'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { track } from '@/lib/analytics';
import { CTA } from '@/lib/copy';

type RunState = 'idle' | 'loading' | 'done' | 'error';

type Severity = 'high' | 'medium' | 'low';
type Status = 'pass' | 'needs_attention' | 'fail';

interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  fix: string;
}

interface PlaygroundResult {
  run_id: string;
  status: Status;
  score: number;
  findings: Finding[];
  summary: string;
  duration_ms: number;
  checks_run: number;
  checks_passed: number;
  agent_name: string;
  template_id: string;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: string }> = {
  pass: {
    label: 'Pass',
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-500/40',
    icon: '✅',
  },
  needs_attention: {
    label: 'Needs Attention',
    color: 'text-yellow-400',
    bg: 'bg-yellow-950/40 border-yellow-500/40',
    icon: '⚠️',
  },
  fail: {
    label: 'Fail',
    color: 'text-red-400',
    bg: 'bg-red-950/40 border-red-500/40',
    icon: '❌',
  },
};

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; dot: string }> = {
  high: { label: 'High', color: 'text-red-400', dot: 'bg-red-400' },
  medium: { label: 'Medium', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  low: { label: 'Low', color: 'text-blue-400', dot: 'bg-blue-400' },
};

const TEMPLATES = [
  { id: 'agent-readiness-baseline', label: 'Agent readiness baseline', icon: '▶' },
  { id: 'policy-gate-tool-calls', label: 'Rules gate: tool calls', icon: '🛡' },
  { id: 'regression-suite-starter', label: 'Change detection starter', icon: '⟳' },
];

export default function PlaygroundPage() {
  const router = useRouter();
  const [state, setState] = useState<RunState>('idle');
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);

  async function runCheck() {
    setState('loading');
    setResult(null);
    setErrorMsg('');

    await track('first_success_demo_run_started', {
      source: 'playground',
      template_id: selectedTemplate,
    });

    try {
      const res = await fetch(ROUTES.API.V1.PLAYGROUND, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: selectedTemplate }),
      });

      if (res.status === 429) {
        setErrorMsg('Too many requests. Wait a moment and try again.');
        setState('error');
        return;
      }

      if (!res.ok) {
        setErrorMsg('Something went wrong. Please try again.');
        setState('error');
        return;
      }

      const data = await res.json() as PlaygroundResult;
      setResult(data);
      setState('done');
    } catch {
      setErrorMsg('Network error. Check your connection and try again.');
      setState('error');
    }
  }

  function saveRun() {
    track('signup_started', { source: 'playground', method: 'save_run' });
    router.push(`${ROUTES.REGISTER}?next=/dashboard&from=playground`);
  }

  return (
    <div className="section-container py-12">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-gray-300">Live demo · no login required</span>
        </div>
        <h1 className="text-4xl font-bold mb-3">Playground</h1>
        <p className="text-gray-400 max-w-lg mx-auto">
          Pick a template and run a readiness check. See real findings with fix suggestions — in under 30 seconds.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Template picker */}
        <div className="card mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Choose a template
          </h2>
          <div className="space-y-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                  selectedTemplate === t.id
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-border text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                <span className="mr-2">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        {state !== 'loading' && (
          <button
            onClick={runCheck}
            className="btn-primary w-full text-lg mb-6"
          >
            {state === 'done' ? 'Run again' : 'Run Demo Check (30s)'}
          </button>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div className="card p-8 text-center animate-fade-in mb-6">
            <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Running checks on demo agent…</p>
            <div className="mt-4 space-y-1.5 text-xs text-gray-600 text-left max-w-xs mx-auto">
              <p>✓ Loading agent trace</p>
              <p>✓ Checking tool call budgets</p>
              <p className="animate-pulse">⟳ Evaluating rules gates…</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="card border-red-500/30 bg-red-950/20 p-6 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-red-400 font-semibold">Error</span>
            </div>
            <p className="text-sm text-red-300">{errorMsg}</p>
            <button
              onClick={runCheck}
              className="mt-4 text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Result */}
        {state === 'done' && result && (
          <div className="animate-slide-up">
            {/* Status card */}
            <div className={`card border mb-4 ${STATUS_CONFIG[result.status].bg}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{STATUS_CONFIG[result.status].icon}</span>
                  <div>
                    <div className={`text-xl font-bold ${STATUS_CONFIG[result.status].color}`}>
                      {STATUS_CONFIG[result.status].label}
                    </div>
                    <div className="text-xs text-gray-500">
                      Score: {result.score}/100 · {result.checks_passed}/{result.checks_run} checks passed · {result.duration_ms}ms
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-300">{result.summary}</p>
            </div>

            {/* Findings */}
            {result.findings.length > 0 && (
              <div className="space-y-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                  Findings ({result.findings.length})
                </h3>
                {result.findings.map((f) => {
                  const sev = SEVERITY_CONFIG[f.severity];
                  return (
                    <div key={f.id} className="card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
                        <span className={`text-xs font-medium ${sev.color}`}>{sev.label}</span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="text-xs text-gray-500">{f.category}</span>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">{f.title}</h4>
                      <p className="text-xs text-gray-400 mb-2">{f.detail}</p>
                      <div className="p-2 rounded bg-black/20 border border-white/5">
                        <span className="text-xs text-emerald-400 font-medium">Fix: </span>
                        <span className="text-xs text-gray-300">{f.fix}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Save CTA */}
            <div className="card gradient-border p-6 text-center">
              <h3 className="font-bold mb-2">Want to run this on your agent?</h3>
              <p className="text-sm text-gray-400 mb-4">
                Save this run, connect your own agent, and track changes over time. Free account — no card needed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={saveRun}
                  className="btn-primary flex-1"
                >
                  {CTA.saveRun} — free
                </button>
                <Link href={ROUTES.DOCS} className="btn-secondary flex-1 text-center">
                  Read the docs
                </Link>
              </div>
              <p className="text-xs text-gray-500 mt-3">{CTA.reassurance}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
