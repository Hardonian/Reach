"use client";

import { useEffect, useMemo, useState } from "react";
import {
  compareEventStreams,
  deterministicArenaScore,
  federationReadModel,
  validatePackManifest,
  type EventStep,
  type FederationNode,
  type PackManifest,
} from "@/lib/studio-utils";

const sections = [
  // --- BUILD ---
  "Dashboard",
  "Packs (Build)",
  "Playground",
  "Library",
  // --- RUN ---
  "Reports (Recent)",
  "Lineage (Traces)",
  "Arena (Simulate)",
  "Graph (Map)",
  // --- MANAGE ---
  "Federation",
  "Support",
  "Settings",
] as const;

type Section = (typeof sections)[number];

type CommandResponse = {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
  command: string;
  runId?: string;
  runs?: string[];
};

type StudioState = {
  packDraft: PackManifest;
  runHistory: Array<{
    command: string;
    timestamp: string;
    runId?: string;
    ok: boolean;
  }>;
};

const sampleRunA: EventStep[] = [
  { index: 0, type: "run.started", payloadHash: "a1" },
  { index: 1, type: "policy.allow", payloadHash: "b2" },
  { index: 2, type: "tool.complete", payloadHash: "c3" },
];

const sampleRunB: EventStep[] = [
  { index: 0, type: "run.started", payloadHash: "a1" },
  { index: 1, type: "policy.deny", payloadHash: "b2" },
  { index: 2, type: "tool.complete", payloadHash: "x9" },
];

const federationNodes: FederationNode[] = [
  {
    nodeId: "local-alpha",
    trustScore: 94,
    p50Ms: 14,
    p95Ms: 26,
    successCount: 500,
    failureCount: 2,
    quarantined: false,
  },
  {
    nodeId: "mesh-beta",
    trustScore: 58,
    p50Ms: 39,
    p95Ms: 90,
    successCount: 234,
    failureCount: 31,
    quarantined: true,
  },
];

const baseManifest: PackManifest = {
  name: "governed-starter",
  specVersion: "1.0",
  policyContract: "policy/default.contract.json",
  tests: ["tests/conformance.policy.json"],
};

export function StudioShell() {
  const [active, setActive] = useState<Section>("Dashboard");
  const [manifest, setManifest] = useState<PackManifest>(baseManifest);
  const [runInventory, setRunInventory] = useState<string[]>([]);
  const [selectedRun, setSelectedRun] = useState("");
  const [runHistory, setRunHistory] = useState<
    Array<{ command: string; timestamp: string; runId?: string; ok: boolean }>
  >([]);
  const [commandOutput, setCommandOutput] = useState(
    "Ready. Studio runs local-first commands via reachctl.",
  );
  const [busy, setBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const manifestCheck = useMemo(() => validatePackManifest(manifest), [manifest]);
  const eventDiff = useMemo(() => compareEventStreams(sampleRunA, sampleRunB), []);
  const trust = useMemo(() => federationReadModel(federationNodes), []);
  const arenaScore = useMemo(
    () => deterministicArenaScore(`${manifest.name}:baseline`, [0.3, 0.2, 0.25, 0.25]),
    [manifest.name],
  );

  useEffect(() => {
    async function hydrateState() {
      const stateRes = await fetch("/api/studio/state").catch(() => null);
      if (stateRes?.ok) {
        const payload = (await stateRes.json()) as { state: StudioState };
        setManifest(payload.state.packDraft);
        setRunHistory(payload.state.runHistory);
      }
      await refreshRunInventory();
    }
    void hydrateState();
  }, []);

  async function persistState(nextManifest: PackManifest, nextHistory: StudioState["runHistory"]) {
    await fetch("/api/studio/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: { packDraft: nextManifest, runHistory: nextHistory },
      }),
    }).catch(() => null);
  }

  async function refreshRunInventory() {
    const response = await fetch("/api/studio/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "runs.inventory" }),
    });
    const data = (await response.json()) as CommandResponse;
    const runs = data.runs || [];
    setRunInventory(runs);
    setSelectedRun((current) => (current && runs.includes(current) ? current : runs[0] || ""));
  }

  function updateManifest(mutator: (draft: PackManifest) => PackManifest) {
    setManifest((current) => {
      const next = mutator(current);
      void persistState(next, runHistory);
      return next;
    });
  }

  async function runCommand(command: string) {
    setBusy(true);
    const response = await fetch("/api/studio/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, runId: selectedRun || undefined }),
    });
    const data = (await response.json()) as CommandResponse;
    const timestamp = new Date().toISOString();
    const nextHistory = [
      { command: data.command, timestamp, runId: data.runId, ok: data.ok },
      ...runHistory,
    ].slice(0, 20);
    setRunHistory(nextHistory);
    setCommandOutput(
      [
        `> ${data.command} (exit=${data.code})${data.runId ? ` [run=${data.runId}]` : ""}`,
        data.stdout || "(no stdout)",
        data.stderr ? `stderr:\n${data.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    await persistState(manifest, nextHistory);
    if (command === "report.create") {
      await refreshRunInventory();
    }
    setBusy(false);
  }

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 16,
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 16,
      }}
    >
      <aside aria-label="Studio sections">
        <h1 style={{ marginBottom: 12 }}>ReadyLayer Studio</h1>
        <p style={{ marginBottom: 12, fontSize: 13, opacity: 0.8 }}>
          Local-first control surface for deterministic build, run, replay, trust, and support
          workflows.
        </p>
        <nav style={{ display: "grid", gap: 8 }}>
          {sections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActive(section)}
              style={{
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #2d2d2d",
                background: active === section ? "#181818" : "#111",
                color: "#fafafa",
              }}
            >
              {section}
            </button>
          ))}
        </nav>
      </aside>

      <section
        aria-live="polite"
        style={{
          border: "1px solid #2d2d2d",
          borderRadius: 12,
          padding: 16,
          background: "#0f0f0f",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <label htmlFor="run-picker">Selected run</label>
          <select
            id="run-picker"
            value={selectedRun}
            onChange={(e) => setSelectedRun(e.target.value)}
          >
            <option value="">(none)</option>
            {runInventory.map((runId) => (
              <option key={runId} value={runId}>
                {runId}
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={() => void refreshRunInventory()}>
            Refresh inventory
          </button>
        </div>

        {active === "Dashboard" && (
          <>
            <h2>Dashboard</h2>
            <ul>
              <li>Determinism guard: replay model is immutable and compared event-by-event.</li>
              <li>Policy gate: required for pack validation before sign/verify controls.</li>
              <li>Signing + proof: reachable via Studio actions and reachctl parity buttons.</li>
              <li>Offline mode: all commands call local reachctl and local KB retrieval only.</li>
            </ul>
          </>
        )}

        {active === "Packs (Build)" && (
          <>
            <h2>Packs (Build)</h2>
            <p>Create, validate, and sign governed packs using existing CLI semantics.</p>
            <div style={{ display: "grid", gap: 8, margin: "12px 0" }}>
              <label>
                Template
                <select
                  value={manifest.name}
                  onChange={(e) => updateManifest((m) => ({ ...m, name: e.target.value }))}
                  style={{ marginLeft: 8 }}
                >
                  <option value="governed-starter">governed/default</option>
                  <option value="policy-heavy">governed/high-policy</option>
                </select>
              </label>
              <label>
                specVersion
                <input
                  value={manifest.specVersion}
                  onChange={(e) =>
                    updateManifest((m) => ({
                      ...m,
                      specVersion: e.target.value,
                    }))
                  }
                  style={{ marginLeft: 8 }}
                />
              </label>
              <label>
                Policy contract
                <input
                  value={manifest.policyContract || ""}
                  onChange={(e) =>
                    updateManifest((m) => ({
                      ...m,
                      policyContract: e.target.value,
                    }))
                  }
                  style={{ marginLeft: 8, minWidth: 320 }}
                />
              </label>
            </div>
            <p>Validation: {manifestCheck.valid ? "PASS" : "FAIL"}</p>
            {manifestCheck.errors.length > 0 && <pre>{manifestCheck.errors.join("\n")}</pre>}
            {manifestCheck.warnings.length > 0 && <pre>{manifestCheck.warnings.join("\n")}</pre>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => runCommand("packs.init")}>
                init
              </button>
              <button disabled={busy} onClick={() => runCommand("packs.validate")}>
                validate
              </button>
              <button disabled={busy} onClick={() => runCommand("packs.sign")}>
                sign
              </button>
              <button disabled={busy} onClick={() => runCommand("packs.verify")}>
                verify
              </button>
            </div>
          </>
        )}

        {active === "Library" && (
          <>
            <h2>Library</h2>
            <p>Git-backed registry browser with verification-first install path.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => runCommand("marketplace.search")}>
                Search
              </button>
              <button disabled={busy} onClick={() => runCommand("marketplace.install")}>
                Install
              </button>
              <button disabled={busy} onClick={() => runCommand("packs.verify")}>
                Verify
              </button>
            </div>
          </>
        )}

        {active === "Reports (Recent)" && (
          <>
            <h2>Reports (Recent)</h2>
            <p>
              Selected run: {selectedRun || "none"}. Report and proof actions bind to this run
              selection.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => runCommand("runs.list")}>
                Operator summary
              </button>
              <button disabled={busy || !selectedRun} onClick={() => runCommand("runs.explain")}>
                Explain this run
              </button>
              <button disabled={busy || !selectedRun} onClick={() => runCommand("report.create")}>
                Create report
              </button>
            </div>
          </>
        )}

        {active === "Graph (Map)" && (
          <>
            <h2>Graph</h2>
            <p>Workflow overlay markers:</p>
            <ul>
              <li>🟢 policy allow nodes</li>
              <li>🔴 policy deny nodes</li>
              <li>🟦 delegation hops</li>
              <li>🟨 replay verification warnings</li>
            </ul>
            <button disabled={busy || !selectedRun} onClick={() => runCommand("graph.export")}>
              Export graph (json)
            </button>
          </>
        )}

        {active === "Lineage (Traces)" && (
          <>
            <h2>Lineage (Traces)</h2>
            <p>Combined audit log and execution trace view for side-by-side verification.</p>
            <label>
              Step
              <input
                type="range"
                min={0}
                max={sampleRunA.length - 1}
                value={stepIndex}
                onChange={(e) => setStepIndex(Number(e.target.value))}
              />
            </label>
            <pre style={{ fontSize: 11, background: "#050505", padding: 8 }}>
              {JSON.stringify(sampleRunA[stepIndex], null, 2)}
            </pre>
            <p>Reviewing run A vs B: {eventDiff.length} mismatch(es).</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={busy} onClick={() => runCommand("replay.verify")}>
                Verify lineage
              </button>
              <button disabled={busy} onClick={() => runCommand("report.replay")}>
                Replay report
              </button>
            </div>
          </>
        )}

        {active === "Federation" && (
          <>
            <h2>Federation</h2>
            <p>
              Total nodes: {trust.total} • quarantined: {trust.quarantined} • avg trust:{" "}
              {trust.avgTrust}
            </p>
            <svg
              width="320"
              height="140"
              role="img"
              aria-label="Federation topology"
              style={{ border: "1px solid #333" }}
            >
              <circle cx="70" cy="70" r="24" fill="#1e7" />
              <text x="38" y="110" fill="#ddd" fontSize="12">
                local-alpha
              </text>
              <circle cx="230" cy="70" r="24" fill="#d75" />
              <text x="200" y="110" fill="#ddd" fontSize="12">
                mesh-beta
              </text>
              <line x1="94" y1="70" x2="206" y2="70" stroke="#8aa" strokeWidth="2" />
            </svg>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button disabled={busy} onClick={() => runCommand("federation.status")}>
                Refresh status
              </button>
              <button disabled={busy} onClick={() => runCommand("federation.map")}>
                Export topology
              </button>
            </div>
          </>
        )}

        {active === "Arena (Simulate)" && (
          <>
            <h2>Arena (Simulation)</h2>
            <p>Scenario: arcadeSafe baseline</p>
            <p>Deterministic score: {arenaScore.toFixed(2)}</p>
            <button disabled={busy} onClick={() => runCommand("arena.run")}>
              Run comparison
            </button>
          </>
        )}

        {active === "Playground" && (
          <>
            <h2>Playground</h2>
            <p>Zero-install safe adapter demo with explicit policy and replay visibility.</p>
            <button disabled={busy} onClick={() => runCommand("playground.export")}>
              Export demo
            </button>
          </>
        )}

        {active === "Support" && (
          <>
            <h2>Support</h2>
            <p>
              Use local KB-backed support for safe troubleshooting. Optional hosted LLM remains
              opt-in via env key.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/support">Open support chat</a>
              <button disabled={busy || !selectedRun} onClick={() => runCommand("proof.verify")}>
                Generate verification report
              </button>
            </div>
          </>
        )}

        {active === "Settings" && (
          <>
            <h2>Settings</h2>
            <p>Manage infrastructure keys, tenant policies, and release gate thresholds.</p>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <button disabled={busy} onClick={() => runCommand("config.view")}>
                View current config
              </button>
              <button disabled={busy} onClick={() => runCommand("config.validate")}>
                Validate local environment
              </button>
            </div>
          </>
        )}

        <hr style={{ margin: "16px 0" }} />
        <h3>Recent command snapshots</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#090909",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {runHistory.length === 0 ? "No snapshots yet." : JSON.stringify(runHistory, null, 2)}
        </pre>

        <h3>Command output</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#090909",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {busy ? "Running…" : commandOutput}
        </pre>
      </section>
    </main>
  );
}
