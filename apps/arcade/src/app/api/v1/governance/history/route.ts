import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse, requireAuth } from "@/lib/cloud-auth";
import { listGovernanceArtifacts, listGovernanceSpecs } from "@/lib/cloud-db";
import { GovernanceScopeSchema } from "@/lib/cloud-schemas";
import type { GovernanceSpec } from "@/lib/governance/compiler";
import { diffGovernanceSpec } from "@/lib/governance/diff";
import { logger } from "@/lib/logger";
import { incrementCounter } from "@/lib/observability";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

function asGovernanceSpec(value: Record<string, unknown>): GovernanceSpec | null {
  if (!value || typeof value !== "object") return null;
  if (!Array.isArray(value.gates) || !Array.isArray(value.thresholds)) return null;
  if (value.rolloutMode !== "dry-run" && value.rolloutMode !== "enforced") return null;
  return value as GovernanceSpec;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const workspaceId = req.nextUrl.searchParams.get("workspace_id") ?? "default";
    const limit = Math.max(
      1,
      Math.min(Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10), 200),
    );

    const scopeParam = req.nextUrl.searchParams.get("scope");
    const scope = scopeParam
      ? GovernanceScopeSchema.safeParse(scopeParam)
      : ({ success: true, data: undefined } as const);

    if (!scope.success) {
      return governanceError(
        scope.error.issues[0]?.message ?? "Invalid scope",
        400,
        "GOV_HISTORY_INVALID_SCOPE",
      );
    }

    const history = listGovernanceSpecs({
      orgId: ctx.tenantId,
      workspaceId,
      scope: scope.data,
      limit,
    });

    const ordered = [...history].sort((a, b) => {
      if (a.created_at < b.created_at) return 1;
      if (a.created_at > b.created_at) return -1;
      return b.version - a.version;
    });

    const timeline = ordered.map((entry, index) => {
      const previous = ordered[index + 1];
      const currentSpec = asGovernanceSpec(entry.spec);
      const previousSpec = previous ? asGovernanceSpec(previous.spec) : null;
      const diff = currentSpec
        ? diffGovernanceSpec(previousSpec, currentSpec)
        : {
            hasChanges: false,
            summary: "Unable to diff spec payload.",
            gateDelta: { added: 0, removed: 0, changed: 0 },
            thresholdDelta: { added: 0, removed: 0, changed: 0 },
          };

      const artifacts = listGovernanceArtifacts({
        orgId: ctx.tenantId,
        workspaceId,
        specId: entry.id,
      }).map((artifact) => ({
        id: artifact.id,
        type: artifact.artifact_type,
        path: artifact.artifact_path,
        hash: artifact.output_hash ?? artifact.content_hash,
        output_hash: artifact.output_hash ?? artifact.content_hash,
        spec_hash: artifact.spec_hash,
        engine_name: artifact.engine_name,
        engine_version: artifact.engine_version,
        link: `/api/v1/governance/artifacts/${artifact.id}`,
      }));

      return {
        id: entry.id,
        version: entry.version,
        scope: entry.scope,
        source_intent: entry.source_intent,
        triggered_by: entry.triggered_by,
        actor_user_id: entry.actor_user_id,
        spec_hash: entry.spec_hash,
        rollout_mode: entry.rollout_mode,
        risk_summary: entry.risk_summary,
        replay_link: entry.replay_link,
        created_at: entry.created_at,
        diff,
        artifacts,
      };
    });
    const conflictCount = timeline.filter((entry) => entry.diff.hasChanges).length;
    if (conflictCount > 0) {
      incrementCounter("conflict_classifications_generated", {
        tenantId: ctx.tenantId,
        by: conflictCount,
      });
    }

    return NextResponse.json({
      workspace_id: workspaceId,
      scope: scope.data ?? "all",
      timeline,
    });
  } catch (err) {
    logger.warn("Governance history read failed", {
      tenant_id: ctx.tenantId,
      err: String(err),
    });
    return governanceError(
      "Governance history unavailable",
      503,
      "GOV_HISTORY_UNAVAILABLE",
      "Verify cloud configuration and try again.",
    );
  }
}
