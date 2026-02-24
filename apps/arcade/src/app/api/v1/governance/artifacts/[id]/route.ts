import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse, requireAuth } from "@/lib/cloud-auth";
import { getGovernanceArtifactById } from "@/lib/cloud-db";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

function safeDownloadName(artifactPath: string): string {
  const base = path.basename(artifactPath);
  return base.length > 0 ? base.replace(/[^a-zA-Z0-9._-]/g, "_") : "artifact.txt";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { id } = await context.params;
    const artifact = getGovernanceArtifactById(id, ctx.tenantId);
    if (!artifact) {
      return governanceError("Governance artifact not found", 404, "GOV_ARTIFACT_NOT_FOUND");
    }

    const download = req.nextUrl.searchParams.get("download") === "1";
    if (download) {
      return new NextResponse(artifact.content_text, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `attachment; filename="${safeDownloadName(artifact.artifact_path)}"`,
          "x-reach-spec-hash": artifact.spec_hash ?? "",
          "x-reach-artifact-hash": artifact.output_hash ?? artifact.content_hash,
        },
      });
    }

    return NextResponse.json({
      id: artifact.id,
      workspace_id: artifact.workspace_id,
      spec_id: artifact.spec_id,
      type: artifact.artifact_type,
      path: artifact.artifact_path,
      spec_hash: artifact.spec_hash,
      artifact_hash: artifact.output_hash ?? artifact.content_hash,
      engine_name: artifact.engine_name,
      engine_version: artifact.engine_version,
      actor_type: artifact.actor_type,
      actor_user_id: artifact.actor_user_id,
      triggered_by: artifact.triggered_by,
      created_at: artifact.created_at,
      source_intent: artifact.source_intent,
      governance_plan: artifact.governance_plan,
      links: {
        download: `/api/v1/governance/artifacts/${artifact.id}?download=1`,
      },
    });
  } catch {
    return governanceError(
      "Governance artifact unavailable",
      503,
      "GOV_ARTIFACT_UNAVAILABLE",
      "Retry shortly. If this persists, verify governance artifact storage health.",
    );
  }
}
