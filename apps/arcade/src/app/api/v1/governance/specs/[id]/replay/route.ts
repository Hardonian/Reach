import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse, requireAuth } from "@/lib/cloud-auth";
import { getGovernanceSpecById, listGovernanceArtifacts } from "@/lib/cloud-db";
import { sha256Hex, stableStringify } from "@/lib/governance/compiler";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await context.params;
    const spec = getGovernanceSpecById(id, ctx.tenantId);
    if (!spec) return governanceError("Governance spec not found", 404, "GOV_REPLAY_NOT_FOUND");

    const canonical = stableStringify(spec.spec);
    const recomputedHash = sha256Hex(canonical);
    const deterministic = recomputedHash === spec.spec_hash;

    const artifacts = listGovernanceArtifacts({
      orgId: ctx.tenantId,
      workspaceId: spec.workspace_id,
      specId: spec.id,
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

    return NextResponse.json({
      spec_id: spec.id,
      workspace_id: spec.workspace_id,
      scope: spec.scope,
      version: spec.version,
      stored_hash: spec.spec_hash,
      recomputed_hash: recomputedHash,
      deterministic,
      replay_link: spec.replay_link,
      artifacts,
      spec: spec.spec,
    });
  } catch {
    return governanceError(
      "Replay verification unavailable",
      503,
      "GOV_REPLAY_UNAVAILABLE",
      "Retry shortly. If this persists, verify governance spec storage health.",
    );
  }
}
