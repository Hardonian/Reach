"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { track } from "@/lib/analytics";
import type { Variant } from "@/lib/ab";
import type { CAPABILITIES } from "@/lib/copy";

// ── Demo result types ──────────────────────────────────────────────────────
interface DemoResult {
  status: "pass" | "needs_attention" | "fail";
  finding: string;
  fix: string;
  duration_ms: number;
}

const DEMO_RESULT: DemoResult = {
  status: "needs_attention",
  finding: 'Tool call "search_web" exceeded the 2s timeout budget on 2 of 5 runs.',
  fix: "Set `timeout_ms: 1500` on the search_web tool to stay within SLA.",
  duration_ms: 847,
};

const STATUS_CONFIG = {
  pass: {
    label: "Pass",
    color: "text-emerald-400",
    bg: "bg-emerald-950/40 border-emerald-500/30",
    icon: "✅",
  },
  needs_attention: {
    label: "Needs Attention",
    color: "text-yellow-400",
    bg: "bg-yellow-950/40 border-yellow-500/30",
    icon: "⚠️",
  },
  fail: {
    label: "Fail",
    color: "text-red-400",
    bg: "bg-red-950/40 border-red-500/30",
    icon: "❌",
  },
};

// ── Homepage interactive demo block ───────────────────────────────────────
export function HomepageClient({ variant }: { variant: Variant }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<DemoResult | null>(null);

  async function runDemo() {
    setState("loading");
    await track("first_success_demo_run_started", {
      source: "homepage",
      variant_id: variant,
    });

    // Simulate realistic latency
    await new Promise((r) => setTimeout(r, 1200));
    setResult(DEMO_RESULT);
    setState("done");

    await track("first_success_demo_run_completed", {
      source: "homepage",
      variant_id: variant,
      result_status: DEMO_RESULT.status,
      duration_ms: DEMO_RESULT.duration_ms,
    });
  }

  const cfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="max-w-xl mx-auto">
      {state === "idle" && (
        <div className="card gradient-border text-center p-8">
          <div className="text-4xl mb-4">▶</div>
          <p className="text-gray-400 mb-6 text-sm">
            Runs a sample agent check using built-in demo data. No login needed.
          </p>
          <button onClick={runDemo} className="btn-primary text-lg w-full">
            Run Demo Check (30s)
          </button>
        </div>
      )}

      {state === "loading" && (
        <div className="card p-8 text-center animate-fade-in">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Running readiness checks on demo agent…</p>
          <div className="mt-4 space-y-2 text-xs text-gray-600">
            <p>✓ Loading demo agent trace</p>
            <p>✓ Checking tool call budget</p>
            <p className="animate-pulse">⟳ Evaluating policy gates…</p>
          </div>
        </div>
      )}

      {state === "done" && result && cfg && (
        <div className={`card border animate-slide-up ${cfg.bg} p-6`}>
          {/* Badge */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{cfg.icon}</span>
            <div>
              <div className={`font-bold text-lg ${cfg.color}`}>{cfg.label}</div>
              <div className="text-xs text-gray-500">{result.duration_ms}ms · demo run</div>
            </div>
          </div>

          {/* Finding */}
          <div className="mb-4 p-3 rounded-lg bg-black/20 border border-white/5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Finding</div>
            <p className="text-sm text-gray-200">{result.finding}</p>
          </div>

          {/* Fix */}
          <div className="mb-6 p-3 rounded-lg bg-black/20 border border-white/5">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Recommended fix
            </div>
            <p className="text-sm text-gray-200">{result.fix}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={ROUTES.PLAYGROUND}
              className="btn-primary text-sm text-center flex-1"
              onClick={() =>
                track("cta_clicked", {
                  source: "homepage_demo_result",
                  cta: "open_playground",
                })
              }
            >
              Run on your agent →
            </Link>
            <Link
              href={ROUTES.REGISTER}
              className="btn-secondary text-sm text-center flex-1"
              onClick={() =>
                track("signup_started", {
                  source: "homepage_demo_result",
                  method: "demo_save",
                })
              }
            >
              Save this run (free)
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expandable extra capabilities ─────────────────────────────────────────
type Cap = (typeof CAPABILITIES)[number];

export function HomepageExtraCapabilities({ caps }: { caps: readonly Cap[] }) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <div className="text-center">
        <button
          onClick={() => setShowMore(!showMore)}
          className="text-sm text-accent hover:text-accent/80 transition-colors font-medium"
        >
          {showMore ? "▲ Show less" : `▼ Show ${caps.length} more capabilities`}
        </button>
      </div>

      {showMore && (
        <div className="grid md:grid-cols-3 gap-6 mt-6 animate-fade-in">
          {caps.map((cap) => (
            <Link
              key={cap.title}
              href={cap.href}
              className="card group hover:border-accent/50 transition-all"
            >
              <h3 className="font-bold mb-2 group-hover:text-accent transition-colors">
                {cap.title}
              </h3>
              <p className="text-gray-400 text-sm">{cap.description}</p>
              <div className="mt-4 flex items-center text-accent text-sm font-medium">
                Learn more
                <svg
                  className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
