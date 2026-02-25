import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/cloud-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = await requireAuth(req);
  if (ctx instanceof NextResponse) return ctx;

  return NextResponse.json({
    surface: "sccl",
    status: "ready",
    tenant_id: ctx.tenantId,
    endpoints: {
      artifacts: "/api/v1/governance/artifacts/{id}",
      history: "/api/v1/governance/history",
      replay: "/api/v1/governance/specs/{id}/replay",
    },
  });
}
