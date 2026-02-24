import Link from "next/link";
import { ConsoleLayout } from "@/components/stitch/console/ConsoleLayout";
import { getServerAuth } from "@/lib/cloud-auth";
import { listGovernanceArtifacts, listGovernanceSpecs } from "@/lib/cloud-db";
import type { GovernanceSpec } from "@/lib/governance/compiler";
import { diffGovernanceSpec } from "@/lib/governance/diff";

export const metadata = {
  title: "Governance Timeline | ReadyLayer Console",
};

function asGovernanceSpec(value: Record<string, unknown>): GovernanceSpec | null {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray(value.gates) || !Array.isArray(value.thresholds)) return null;
  if (value.rolloutMode !== "dry-run" && value.rolloutMode !== "enforced") return null;
  return value as GovernanceSpec;
}

export default async function GovernanceHistoryPage() {
  const auth = await getServerAuth();
  const workspaceId = "default";

  if (!auth) {
    return (
      <ConsoleLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold">Governance Timeline</h1>
          <p className="mt-2 text-sm text-gray-400">
            Sign in to view tenant-scoped governance history.
          </p>
        </div>
      </ConsoleLayout>
    );
  }

  const specs = listGovernanceSpecs({
    orgId: auth.tenantId,
    workspaceId,
    limit: 100,
  });

  const ordered = [...specs].sort((a, b) => {
    if (a.created_at < b.created_at) return 1;
    if (a.created_at > b.created_at) return -1;
    return b.version - a.version;
  });

  const rows = ordered.map((entry, index) => {
    const previous = ordered[index + 1];
    const currentSpec = asGovernanceSpec(entry.spec);
    const previousSpec = previous ? asGovernanceSpec(previous.spec) : null;
    const diff = currentSpec
      ? diffGovernanceSpec(previousSpec, currentSpec)
      : {
          summary: "No structured diff available.",
        };

    const artifacts = listGovernanceArtifacts({
      orgId: auth.tenantId,
      workspaceId,
      specId: entry.id,
    });

    return {
      id: entry.id,
      version: entry.version,
      sourceIntent: entry.source_intent,
      triggeredBy: entry.triggered_by,
      specHash: entry.spec_hash,
      replayLink: entry.replay_link,
      createdAt: entry.created_at,
      diff: diff.summary,
      artifactCount: artifacts.length,
    };
  });

  return (
    <ConsoleLayout>
      <div className="p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Governance Timeline</h1>
            <p className="mt-2 text-sm text-gray-400">
              Deterministic history of governance actions for workspace <code>{workspaceId}</code>.
            </p>
          </div>
          <Link href="/assistant" className="btn-primary">
            Open NL Assistant
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/40 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Triggered</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Diff</th>
                <th className="px-4 py-3">Determinism Hash</th>
                <th className="px-4 py-3">Artifacts</th>
                <th className="px-4 py-3">Replay</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-gray-500">
                    No governance history yet. Start in{" "}
                    <Link href="/assistant" className="text-accent hover:underline">
                      Assistant
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 align-top">
                    <td className="px-4 py-3 font-mono">v{row.version}</td>
                    <td className="px-4 py-3">
                      <div className="capitalize">{row.triggeredBy}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(row.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[360px] text-gray-300">{row.sourceIntent}</td>
                    <td className="px-4 py-3 text-gray-300">{row.diff}</td>
                    <td className="px-4 py-3 font-mono text-xs text-emerald-300">{row.specHash}</td>
                    <td className="px-4 py-3">{row.artifactCount}</td>
                    <td className="px-4 py-3">
                      {row.replayLink ? (
                        <a href={row.replayLink} className="text-accent hover:underline">
                          Replay
                        </a>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ConsoleLayout>
  );
}
