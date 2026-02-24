import { NextRequest, NextResponse } from "next/server";
import { cloudErrorResponse, requireAuth, requireRole } from "@/lib/cloud-auth";
import { getEntitlement, listGovernanceSpecs } from "@/lib/cloud-db";
import { buildEnterpriseGovernanceAnalytics } from "@/lib/enterprise/governance-analytics";

export const runtime = "nodejs";

function governanceError(
  message: string,
  status: number,
  code: string,
  hint?: string,
): NextResponse {
  return cloudErrorResponse(message, status, undefined, { code, hint });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  if (!requireRole(ctx, "admin")) {
    return governanceError("Admin role required", 403, "GOV_ENTERPRISE_ADMIN_REQUIRED");
  }

  try {
    const entitlement = getEntitlement(ctx.tenantId);
    if (entitlement?.plan !== "enterprise") {
      return governanceError(
        "Enterprise plan required for cross-org governance analytics",
        403,
        "GOV_ENTERPRISE_PLAN_REQUIRED",
      );
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
    return governanceError(
      "Enterprise governance analytics unavailable",
      503,
      "GOV_ENTERPRISE_UNAVAILABLE",
      "Check enterprise entitlements and data-plane health.",
    );
  }
}
