import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse, requireAuth, requireRole } from "@/lib/cloud-auth";
import { getEntitlement, listGovernanceSpecs } from "@/lib/cloud-db";
import { buildEnterpriseGovernanceAnalytics } from "@/lib/enterprise/governance-analytics";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!requireRole(ctx, "admin")) {
    return cloudErrorResponse("Admin role required", 403);
  }

  try {
    const entitlement = getEntitlement(ctx.tenantId);
    if (entitlement?.plan !== "enterprise") {
      return cloudErrorResponse("Enterprise plan required for cross-org governance analytics", 403);
    }

    const workspaceId = req.nextUrl.searchParams.get("workspace_id") ?? "default";
    const specs = listGovernanceSpecs({
      orgId: ctx.tenantId,
      workspaceId,
      limit: 500,
    });

    return NextResponse.json({
      workspace_id: workspaceId,
      analytics: buildEnterpriseGovernanceAnalytics(specs),
    });
  } catch {
    return cloudErrorResponse("Enterprise governance analytics unavailable", 503);
  }
}
