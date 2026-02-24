"use client";

import { useMemo, useState } from "react";

interface AssistantResponse {
  mode: "preview" | "apply";
  applied: boolean;
  source_intent: string;
  plan: {
    summary: string;
    intents: string[];
    rationale: string[];
    memorySignals: string[];
  };
  spec: Record<string, unknown>;
  spec_hash: string;
  rollout_mode: "dry-run" | "enforced";
  impact_preview: {
    wouldFailToday: string[];
    affectedRepos: string[];
    costDeltaPct: number;
    evalDeltaPct: number;
  };
  diff: {
    summary: string;
  };
  explainability: {
    riskImpactSummary: string[];
  };
  artifacts: Array<{
    type: string;
    path: string;
    hash: string;
  }>;
  spec_id?: string;
  spec_version?: number;
  replay_link?: string;
}

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface ApiErrorPayload {
  error?: string;
  error_code?: string;
  hint?: string;
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderApiError(payload: ApiErrorPayload, fallback: string): string {
  const message = payload.error ?? fallback;
  const code = payload.error_code ? ` [${payload.error_code}]` : "";
  const hint = payload.hint ? ` ${payload.hint}` : "";
  return `${message}${code}${hint}`;
}

export default function GovernanceAssistantPage() {
  const [workspaceId, setWorkspaceId] = useState("default");
  const [intent, setIntent] = useState(
    "Make sure no PR deploys unless evaluation score >= 0.9 and require provenance for generated artifacts.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssistantResponse | null>(null);
  const [showSpec, setShowSpec] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [chat, setChat] = useState<ChatItem[]>([]);

  const workflowArtifact = useMemo(
    () =>
      preview?.artifacts.find((artifact) => artifact.path === ".github/workflows/reach-gates.yml"),
    [preview],
  );

  async function submit(action: "preview" | "apply") {
    setLoading(true);
    setError(null);

    const userEntry: ChatItem = {
      id: `u_${Date.now()}`,
      role: "user",
      text: intent,
    };
    setChat((items) => [...items, userEntry]);

    try {
      const response = await fetch("/api/v1/governance/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent,
          workspace_id: workspaceId,
          scope: "project",
          action,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AssistantResponse &
        ApiErrorPayload;

      if (!response.ok) {
        setError(renderApiError(payload, "Request failed"));
        return;
      }

      setPreview(payload);

      setChat((items) => [
        ...items,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          text: payload.applied
            ? `Applied governance spec v${payload.spec_version} with hash ${payload.spec_hash}.`
            : `Drafted governance preview with hash ${payload.spec_hash}.`,
        },
      ]);

      if (intent.toLowerCase().includes("show spec")) {
        setShowSpec(true);
      }
    } catch {
      setError("Governance assistant unavailable. Check cloud configuration and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section-container py-10">
      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface/60 p-6">
          <h1 className="text-3xl font-bold">Governance Assistant</h1>
          <p className="text-gray-400 mt-2">
            Conversation → Preview → Apply. Natural language is compiled into deterministic
            governance specs.
          </p>

          <label className="block mt-6 text-sm text-gray-400">Workspace</label>
          <input
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <label className="block mt-4 text-sm text-gray-400">Intent</label>
          <textarea
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            className="w-full mt-1 min-h-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={loading}
              onClick={() => void submit("preview")}
              className="btn-primary disabled:opacity-60"
            >
              {loading ? "Compiling..." : "Preview (dry-run)"}
            </button>
            <button
              disabled={loading}
              onClick={() => void submit("apply")}
              className="btn-secondary disabled:opacity-60"
            >
              Apply
            </button>
            <button
              disabled={!preview}
              onClick={() =>
                preview && downloadJson(`governance-spec-${preview.spec_hash}.json`, preview.spec)
              }
              className="btn-secondary disabled:opacity-60"
            >
              Export config
            </button>
            <button
              disabled={!preview}
              onClick={() => setShowSpec((value) => !value)}
              className="btn-secondary disabled:opacity-60"
            >
              {showSpec ? "Hide spec" : "Show spec"}
            </button>
            <button
              disabled={!preview}
              onClick={() => setShowRaw((value) => !value)}
              className="btn-secondary disabled:opacity-60"
            >
              {showRaw ? "Hide raw gate file" : "Raw gate file"}
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {showSpec && preview && (
            <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs text-emerald-300">
              {JSON.stringify(preview.spec, null, 2)}
            </pre>
          )}

          {showRaw && preview && (
            <pre className="mt-6 overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs text-slate-300">
              {JSON.stringify(
                {
                  source_intent: preview.source_intent,
                  spec_hash: preview.spec_hash,
                  artifacts: preview.artifacts,
                },
                null,
                2,
              )}
            </pre>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface/60 p-6 space-y-5">
          <h2 className="text-xl font-semibold">Impact Preview</h2>
          {preview ? (
            <>
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <p className="text-sm text-gray-300">{preview.plan.summary}</p>
                <p className="mt-2 text-xs text-gray-500">Diff: {preview.diff.summary}</p>
                <p className="mt-2 text-xs text-gray-500">Determinism hash: {preview.spec_hash}</p>
                <p className="mt-2 text-xs text-gray-500">Rollout mode: {preview.rollout_mode}</p>
                {preview.replay_link && (
                  <a
                    href={preview.replay_link}
                    className="mt-2 inline-block text-xs text-accent hover:underline"
                  >
                    Replay link
                  </a>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="text-gray-500 text-xs uppercase tracking-wide">
                    Would fail today
                  </div>
                  <ul className="mt-2 space-y-1 text-gray-300">
                    {preview.impact_preview.wouldFailToday.length > 0 ? (
                      preview.impact_preview.wouldFailToday.map((line) => (
                        <li key={line}>• {line}</li>
                      ))
                    ) : (
                      <li>• No immediate failures predicted.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-lg border border-border bg-background/50 p-3">
                  <div className="text-gray-500 text-xs uppercase tracking-wide">Delta</div>
                  <p className="mt-2 text-gray-300">
                    Cost: +{preview.impact_preview.costDeltaPct.toFixed(1)}%
                  </p>
                  <p className="text-gray-300">
                    Eval: +{preview.impact_preview.evalDeltaPct.toFixed(1)}%
                  </p>
                  <p className="text-gray-300">
                    Repos: {preview.impact_preview.affectedRepos.join(", ")}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-3">
                <div className="text-gray-500 text-xs uppercase tracking-wide">Explainability</div>
                <ul className="mt-2 space-y-1 text-gray-300 text-sm">
                  {preview.explainability.riskImpactSummary.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-background/50 p-3">
                <div className="text-gray-500 text-xs uppercase tracking-wide">
                  Generated CI artifact
                </div>
                <p className="mt-2 text-sm text-gray-300">
                  {workflowArtifact
                    ? `${workflowArtifact.path} (${workflowArtifact.hash.slice(0, 12)})`
                    : "No CI workflow generated."}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">
              Submit an intent to generate a governance plan and deterministic spec preview.
            </p>
          )}

          <div className="rounded-lg border border-border bg-background/50 p-3">
            <div className="text-gray-500 text-xs uppercase tracking-wide">Conversation</div>
            <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
              {chat.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                chat.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-md px-3 py-2 text-sm ${
                      item.role === "user"
                        ? "bg-accent/20 text-slate-100"
                        : "bg-surface text-gray-300"
                    }`}
                  >
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500">
                      {item.role}
                    </span>
                    {item.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
